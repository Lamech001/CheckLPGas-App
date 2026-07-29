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
        <Text style={styles.lastUpdated}>Last updated: March 15, 2027</Text>

        <Text style={styles.intro}>
          {`GasAround \u201Cwe\u201D, \u201Cus\u201D, \u201Cour\u201D is committed to protecting your privacy.`}
          This Privacy Policy explains how we collect, use, share, and protect
          your personal information when you use the GasAround mobile
          application.
        </Text>

        <Section title="1) Information We Collect">
          Account and Profile Information: When you register, we collect your
          full name, email address, phone number, role (consumer or supplier),
          and delivery location. For suppliers, we additionally collect your
          business/enterprise name, business location coordinates and address,
          gas cylinder prices and stock availability, and business opening
          hours.
          {"\n\n"}Location Data: With your permission, we collect your device
          {"\u2019"}s approximate location to show nearby gas suppliers on an
          interactive map. During active orders, if you choose to share your
          live location, we collect real-time GPS coordinates which are visible
          to the supplier for delivery coordination. You can disable location
          services at any time in your device settings.
          {"\n\n"}Order Information: When you place or manage orders, we collect
          order details including cylinder size (6kg, 13kg, 19kg), gas brand,
          quantity, delivery address, order status, and timestamp.
          {"\n\n"}Chat Communications: When you communicate with suppliers or
          consumers through our in-app chat feature, we collect and store the
          content of messages, sender information, and timestamps to facilitate
          order coordination.
          {"\n\n"}Device and Usage Information: We collect device type
          (Android/iOS), app version, operating system version, push
          notification tokens, and technical diagnostic information to improve
          app performance and fix bugs.
          {"\n\n"}Ratings and Reviews: When you submit a rating or review for a
          supplier, we collect your rating score (1-5 stars), review text, and
          the supplier you are reviewing.
        </Section>

        <Section title="2) How We Use Your Information">
          We use your information to:
          {"\n\n"}
          {"\u2022"} Provide and improve our gas price comparison and supplier
          discovery service
          {"\n\n"}
          {"\u2022"} Show nearby gas suppliers on an interactive map based on
          your location
          {"\n\n"}
          {"\u2022"} Calculate distances between your location and suppliers
          {"\n\n"}
          {"\u2022"} Facilitate order placement and delivery coordination
          between consumers and suppliers
          {"\n\n"}
          {"\u2022"} Enable real-time chat between consumers and suppliers for
          order coordination
          {"\n\n"}
          {"\u2022"} Allow live location sharing during active orders for
          delivery tracking
          {"\n\n"}
          {"\u2022"} Send push notifications for orders, messages, price
          updates, and app announcements
          {"\n\n"}
          {"\u2022"} Verify your identity and secure your account through email
          verification
          {"\n\n"}
          {"\u2022"} Calculate and display supplier ratings based on consumer
          feedback
          {"\n\n"}
          {"\u2022"} Detect and prevent fraud, abuse, and unauthorized access
          {"\n\n"}
          {"\u2022"} Analyze usage patterns to improve our services and user
          experience
          {"\n\n"}
          {"\u2022"} Comply with legal obligations and enforce our Terms of
          Service
        </Section>

        <Section title="3) How We Share Your Information">
          We share your information only in the following circumstances:
          {"\n\n"}With Suppliers: When you place an order, your name, delivery
          address/location, phone number, and order details are shared with the
          supplier to fulfill your order. If you enable live location sharing,
          your real-time GPS coordinates are shared with the supplier during the
          active order.
          {"\n\n"}With Consumers: Suppliers can see consumer names, order
          details, and live location (when actively shared) for orders they are
          fulfilling.
          {"\n\n"}Service Providers: We share information with third-party
          service providers who help us operate the app, including:
          {"\n"}
          {"\u2022"} Firebase (Google, Inc.) for database storage (Cloud
          Firestore), authentication, cloud functions, and push notifications
          (Cloud Messaging)
          {"\n"}
          {"\u2022"} Expo for push notification delivery and app deployment
          {"\n"}
          {"\u2022"} Google Maps for map display and location services
          {"\n"}
          {"\u2022"} AsyncStorage for local data caching on your device
          {"\n\n"}Legal Requirements: We may disclose information if required by
          law, court order, or governmental regulation, or to protect our
          rights, safety, or property.
          {"\n\n"}Business Transfers: If we sell, merge, or transfer our
          business or assets, your information may be transferred to the new
          owner as part of the transaction. You will be notified of any such
          change.
          {"\n\n"}We do NOT sell your personal information to third parties for
          marketing purposes.
        </Section>

        <Section title="4) Data Storage and Security">
          Your data is stored on Firebase Cloud Firestore (Google Cloud
          Platform), which uses encryption at rest and in transit. We implement
          industry-standard security measures including:
          {"\n\n"}
          {"\u2022"} Firebase Authentication for secure user authentication
          {"\n\n"}
          {"\u2022"} Firestore Security Rules to restrict data access based on
          user roles and authentication status
          {"\n\n"}
          {"\u2022"} Local data encryption via React Native AsyncStorage for
          cached data on your device
          {"\n\n"}
          {"\u2022"} Secure token-based push notification delivery However, no
          method of transmission or storage is 100% secure. While we strive to
          protect your data, we cannot guarantee absolute security.
        </Section>

        <Section title="5) Data Retention">
          We retain your personal information for as long as your account is
          active or as needed to provide our services. When you request account
          deletion through the app settings:
          {"\n\n"}
          {"\u2022"} Your user profile and authentication data are removed
          {"\n\n"}
          {"\u2022"} Your supplier profile (if applicable) is removed
          {"\n\n"}
          {"\u2022"} Your personal data is deleted from our Firestore databases
          {"\n\n"}
          {"\u2022"} Chat conversation histories may be retained in anonymized
          form for analytical purposes
          {"\n\n"}
          {"\u2022"} Local cached data on your device is not automatically
          cleared but may be removed by clearing app data in device settings
          Push notification tokens and anonymized usage data may be retained for
          a reasonable period after account deletion for legitimate business
          purposes.
        </Section>

        <Section title="6) Your Privacy Rights">
          You have the right to:
          {"\n\n"}
          {"\u2022"} Access the personal information we hold about you by
          contacting us
          {"\n\n"}
          {"\u2022"} Correct inaccurate or incomplete information through the
          app{"\u2019"}s profile settings
          {"\n\n"}
          {"\u2022"} Request deletion of your account and associated data via
          the app settings
          {"\n\n"}
          {"\u2022"} Opt out of push notifications in your device settings or
          app preferences
          {"\n\n"}
          {"\u2022"} Disable location services at any time in your device
          settings (this will limit supplier search functionality)
          {"\n\n"}
          {"\u2022"} Stop live location sharing at any time during an active
          order
          {"\n\n"}
          {"\u2022"} Export your data by contacting us at
          gasaroundsupport@gmail.com
        </Section>

        <Section title={"Children\u2019s Privacy"}>
          Our service is not intended for individuals under 13 years of age. We
          do not knowingly collect personal information from children under 13.
          If we discover that a child under 13 has provided us with personal
          information, we will promptly delete it. If you believe a child under
          13 has provided us with data, please contact us.
        </Section>

        <Section title="8) Third-Party Services">
          The GasAround app uses the following third-party services:
          {"\n\n"}
          {"\u2022"} Google Firebase (Authentication, Firestore, Cloud
          Functions, Cloud Messaging)
          {"\n"}
          {"\u2022"} Google Maps Platform (Map display, geocoding)
          {"\n"}
          {"\u2022"} Expo (Push notifications, app distribution)
          {"\n"}
          {"\u2022"} React Native AsyncStorage (Local data caching) Each of
          these services has its own privacy policy governing the handling of
          data. We encourage you to review their policies. We are not
          responsible for the privacy practices of these third parties.
        </Section>

        <Section title="9) Changes to This Policy">
          We may update this Privacy Policy from time to time to reflect changes
          in our data practices, app features, or legal requirements. We will
          notify you of material changes by:
          {"\n\n"}
          {"\u2022"} Posting the updated policy in the app
          {"\n"}
          {"\u2022"} Updating the {"\u201C"}Last updated{"\u201D"} date at the
          top of this policy
          {"\n"}
          {"\u2022"} Sending an in-app notification for significant changes Your
          continued use of the app after changes constitutes acceptance of the
          updated Privacy Policy.
        </Section>

        <Section title="10) Contact Us">
          If you have questions, concerns, or requests regarding this Privacy
          Policy or our data practices, please contact us:
          {"\n\n"}Email: gasaroundsupport@gmail.com
          {"\n\n"}We aim to respond to all inquiries within 48 hours.
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
