import { AppStatusBar } from "@/components/AppStatusBar";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.paragraph}>{children}</Text>
  </View>
);

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <FontAwesome5 name="chevron-left" size={18} color="#1976D2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: June 17, 2026</Text>

        <Text style={styles.intro}>
          GasAround ("we", "us", "our") is committed to protecting your privacy.
        </Text>

        <Section title="1) Information We Collect">
          We collect the following types of information:
          {"\n\n"}Account Information: When you register, we collect your email
          address, phone number, full name, and role (consumer or supplier).
          {"\n\n"}Location Information: With your permission, we collect your
          approximate location to show nearby gas suppliers. You can disable
          location services at any time in your device settings.
          {"\n\n"}Order Information: When you place or manage orders, we collect
          order details including cylinder size, quantity, delivery address, and
          supplier information.
          {"\n\n"}Business Information: For suppliers, we collect business
          details such as enterprise name, location, opening hours, and gas
          prices.
          {"\n\n"}Device Information: We collect device type, app version, and
          technical diagnostic information to improve app performance and fix
          bugs.
          {"\n\n"}Communications: We collect information you send us through
          customer support or in-app communications.
        </Section>

        <Section title="2) How We Use Your Information">
          We use your information to:
          {"\n\n"}Provide and improve our gas price comparison service
          {"\n\n"}Show you nearby gas suppliers based on your location
          {"\n\n"}Process and track your gas orders
          {"\n\n"}Enable communication between consumers and suppliers
          {"\n\n"}Send you notifications about orders, messages, and app updates
          {"\n\n"}Verify your identity and secure your account
          {"\n\n"}Detect and prevent fraud and abuse
          {"\n\n"}Analyze usage patterns to improve our services
        </Section>

        <Section title="3) Sharing Your Information">
          We may share your information in the following ways:
          {"\n\n"}With Suppliers: When you place an order, we share your order
          details and contact information with the relevant supplier to fulfill
          your order.
          {"\n\n"}With Consumers: Suppliers can see consumer order details and
          contact information necessary to fulfill orders.
          {"\n\n"}Service Providers: We share information with third-party
          service providers who help us operate the app, including Firebase
          (Google) for database and authentication services.
          {"\n\n"}Legal Requirements: We may disclose information if required by
          law or to protect our rights, safety, or property.
          {"\n\n"}Business Transfers: If we sell or transfer our business, your
          information may be transferred to the new owner.
        </Section>

        <Section title="4) Data Security">
          We implement industry-standard security measures to protect your
          information, including encryption, secure authentication, and regular
          security audits. However, no method of transmission over the internet
          is 100% secure.
        </Section>

        <Section title="5) Data Retention">
          We retain your information for as long as necessary to provide our
          services and as required by law. You can request deletion of your
          account and associated data through the app settings.
        </Section>

        <Section title="6) Your Privacy Rights">
          You have the right to:
          {"\n\n"}Access the personal information we hold about you
          {"\n\n"}Correct inaccurate information
          {"\n\n"}Request deletion of your personal information
          {"\n\n"}Opt out of marketing communications
          {"\n\n"}Disable location services
          {"\n\n"}Manage notification preferences
        </Section>

        <Section title="7) Location Services">
          The app uses location services to show you nearby gas suppliers.
          Location data is processed on your device and shared with our servers
          only when you explicitly enable location services. You can disable
          location at any time in your device settings.
        </Section>

        <Section title="8) Children's Privacy">
          Our service is not intended for children under 13. We do not knowingly
          collect personal information from children under 13.
        </Section>

        <Section title="9) Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify
          you of any material changes by posting the updated policy in the app
          and updating the "Last updated" date.
        </Section>

        <Section title="10) Contact Us">
          If you have questions about this Privacy Policy or our data practices,
          please contact us at gasaroundsupport@gmail.com
        </Section>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  content: { paddingHorizontal: 16, paddingVertical: 14 },
  lastUpdated: { fontSize: 12, color: "#777", marginBottom: 10 },
  intro: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: "500",
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1976D2",
    marginBottom: 6,
  },
  paragraph: { fontSize: 13, color: "#333", lineHeight: 20 },
});
