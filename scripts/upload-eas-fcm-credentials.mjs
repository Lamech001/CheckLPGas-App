import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const easCliRoot = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "npm",
  "node_modules",
  "eas-cli",
);

const { createGraphqlClient } = require(
  path.join(
    easCliRoot,
    "build/commandUtils/context/contextUtils/createGraphqlClient.js",
  ),
);
const { UserQuery } = require(
  path.join(easCliRoot, "build/graphql/queries/UserQuery.js"),
);
const androidApi = require(
  path.join(easCliRoot, "build/credentials/android/api/GraphqlClient.js"),
);
const { readAndValidateServiceAccountKey } = require(
  path.join(
    easCliRoot,
    "build/credentials/android/utils/googleServiceAccountKey.js",
  ),
);

const PROJECT_NAME = "GasAround";
const ANDROID_PACKAGE = "com.lamech_kosgei.GasAround";
const KEY_PATH = path.resolve("credentials/fcm-service-account.json");

function getSessionSecret() {
  const statePath = path.join(os.homedir(), ".expo", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const sessionSecret = state?.auth?.sessionSecret;
  if (!sessionSecret) {
    throw new Error("No Expo session found. Run `eas login` first.");
  }
  return sessionSecret;
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`Service account file not found: ${KEY_PATH}`);
  }

  const jsonKey = readAndValidateServiceAccountKey(KEY_PATH);
  const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret: getSessionSecret() });
  const me = await UserQuery.currentUserAsync(graphqlClient);
  const account =
    me.primaryAccount ??
    me.accounts?.find((entry) => entry.name === me.username) ??
    me.accounts?.[0];

  if (!account?.id || !account?.name) {
    throw new Error("Could not resolve Expo account for credential upload.");
  }

  const appLookup = {
    account,
    projectName: PROJECT_NAME,
    androidApplicationIdentifier: ANDROID_PACKAGE,
  };

  const existingCredentials =
    await androidApi.getAndroidAppCredentialsWithCommonFieldsAsync(
      graphqlClient,
      appLookup,
    );

  if (existingCredentials?.googleServiceAccountKeyForFcmV1?.id) {
    console.log(
      "FCM V1 service account key is already assigned to",
      ANDROID_PACKAGE,
    );
    return;
  }

  const uploadedKey = await androidApi.createGoogleServiceAccountKeyAsync(
    graphqlClient,
    account,
    jsonKey,
  );

  const appCredentials =
    existingCredentials ??
    (await androidApi.createOrGetExistingAndroidAppCredentialsWithBuildCredentialsAsync(
      graphqlClient,
      appLookup,
    ));

  await androidApi.updateAndroidAppCredentialsAsync(
    graphqlClient,
    appCredentials,
    { googleServiceAccountKeyForFcmV1Id: uploadedKey.id },
  );

  console.log("Uploaded and assigned FCM V1 service account key for", ANDROID_PACKAGE);
  console.log("Project:", `@${account.name}/${PROJECT_NAME}`);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
