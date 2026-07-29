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

function getSessionSecret() {
  const statePath = path.join(os.homedir(), ".expo", "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  return state?.auth?.sessionSecret;
}

async function main() {
  const graphqlClient = createGraphqlClient({
    accessToken: null,
    sessionSecret: getSessionSecret(),
  });
  const me = await UserQuery.currentUserAsync(graphqlClient);
  const account = me.primaryAccount ?? me.accounts?.[0];
  const creds = await androidApi.getAndroidAppCredentialsWithCommonFieldsAsync(
    graphqlClient,
    {
      account,
      projectName: "GasAround",
      androidApplicationIdentifier: "com.lamech_kosgei.GasAround",
    },
  );

  const fcmKey = creds?.googleServiceAccountKeyForFcmV1;
  console.log(
  JSON.stringify(
    {
      androidAppCredentialsId: creds?.id ?? null,
      fcmV1Assigned: Boolean(fcmKey?.id),
      fcmClientEmail: fcmKey?.clientEmail ?? null,
      fcmProjectId: fcmKey?.projectIdentifier ?? null,
    },
    null,
    2,
  ),
  );
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
