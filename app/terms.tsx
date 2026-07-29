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

export default function TermsOfServiceScreen() {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: March 15, 2027</Text>

        <Text style={styles.intro}>
          Welcome to GasAround, a mobile application that connects consumers
          with local cooking gas suppliers for price comparison, ordering, and
          delivery coordination. These Terms of Service govern your use of the
          GasAround app. By using the app, you agree to these Terms.
        </Text>

        <Section title="1) Acceptance of Terms">
          By downloading, accessing, or using the GasAround app, you agree to be
          bound by these Terms of Service. If you do not agree to these Terms,
          please do not use the app.
        </Section>

        <Section title="2) Account Registration">
          To use certain features of the app, you must register for an account.
          You agree to provide accurate, current, and complete information
          during registration including your full name, email address, phone
          number, and location. You are responsible for maintaining the
          confidentiality of your account credentials and for all activities
          that occur under your account. Email verification is required to
          access authenticated features.
        </Section>

        <Section title="3) Consumer Use">
          As a consumer, you may use the app to search for gas suppliers on an
          interactive map, compare gas cylinder prices, view supplier
          information including opening hours and stock availability, place
          orders via in-app chat, and share your live location during active
          orders for delivery coordination. You agree to use the app only for
          legitimate purposes and not for any fraudulent or illegal activities.
        </Section>

        <Section title="4) Supplier Use">
          As a supplier, you may create a business profile, list your gas
          business location on the map, set and update gas cylinder prices (6kg,
          13kg, 19kg sizes), manage stock availability, receive and respond to
          consumer orders through in-app chat, view real-time consumer location
          during active deliveries, and toggle your shop open/closed status. You
          agree to provide accurate information about your business, prices, and
          availability. You are solely responsible for fulfilling orders placed
          through the app.
        </Section>

        <Section title="5) Orders and Transactions">
          All orders placed through the app are between you (the consumer) and
          the supplier. GasAround is not a party to these transactions and does
          not guarantee delivery, quality, or availability of gas cylinders.
          Payment terms are agreed upon directly between you and the supplier.
          The order process includes selecting cylinder size, specifying gas
          brand, confirming delivery location via GPS, and receiving order
          confirmation through in-app chat.
        </Section>

        <Section title="6) In-App Chat and Communications">
          The app provides real-time chat functionality between consumers and
          suppliers for order coordination. Chat messages are stored in
          Firestore and may include order details, delivery updates, and
          coordination information. When you place an order, a dedicated
          conversation thread is created between you and the supplier.
        </Section>

        <Section title="7) Live Location Sharing">
          During an active order, consumers have the option to share their
          real-time device location with the supplier for delivery coordination.
          Location sharing is optional and can be started or stopped at any
          time. When location sharing is active, the supplier can view your
          updated position on a map. Your last shared location remains saved
          even after stopping active sharing so the supplier can still find the
          delivery point. Location data is stored in Firestore as part of your
          conversation with the supplier and is not used for any other purpose.
        </Section>

        <Section title="8) Location Services">
          The app uses your device location to show nearby gas suppliers on a
          map, calculate distances for price comparison, and enable live
          location sharing during active orders. You can enable or disable
          location services in your device settings at any time. Disabling
          location services will limit the app{"\u2019"}s supplier search and
          delivery coordination functionality.
        </Section>

        <Section title="9) Push Notifications">
          The app sends push notifications for order confirmations, new messages
          from suppliers/consumers, price updates from suppliers you follow, and
          other relevant information. You can manage your notification
          preferences in the app settings or device settings.
        </Section>

        <Section title="10) User Content">
          You are responsible for any content you submit to the app, including
          business information, gas prices, reviews, ratings, photos, and chat
          communications. You agree not to submit content that is illegal,
          harmful, threatening, abusive, harassing, defamatory, or misleading.
        </Section>

        <Section title="11) Reviews and Ratings">
          Consumers may leave reviews and ratings (1-5 stars) for suppliers
          after receiving an order. Reviews must be honest and based on actual
          experiences. Suppliers may not post fake reviews or manipulate
          ratings. GasAround reserves the right to remove fraudulent or
          inappropriate reviews.
        </Section>

        <Section title="12) Supplier Rating Distribution">
          Suppliers have a cumulative rating calculated from all consumer
          ratings, displayed alongside a distribution breakdown (number of
          5-star, 4-star, 3-star, 2-star, and 1-star ratings). This information
          is visible to all users to help them make informed decisions.
        </Section>

        <Section title="13) Intellectual Property">
          The GasAround app, its design, logo, and all content are owned by
          GasAround and are protected by intellectual property laws. You may not
          copy, modify, distribute, reverse engineer, or create derivative works
          of the app without express written permission.
        </Section>

        <Section title="14) Privacy">
          Your use of the app is also governed by our Privacy Policy, which
          explains how we collect, use, store, and protect your personal
          information including location data, chat messages, and account
          details. By using the app you consent to the data practices described
          in the Privacy Policy.
        </Section>

        <Section title="15) Data Retention and Deletion">
          We retain your account information and associated data for as long as
          your account is active. You may request deletion of your account and
          associated data through the app settings. Upon account deletion, your
          user profile, supplier profile (if applicable), and personal data will
          be removed from our servers. Chat conversation histories may be
          retained in anonymized form.
        </Section>

        <Section title="16) Disclaimers">
          The app is provided {"\u201C"}as is{"\u201D"} without warranties of
          any kind, either express or implied. GasAround does not guarantee that
          the app will be uninterrupted, timely, secure, or error-free. Supplier
          information including prices and stock availability is provided by
          suppliers and may not always be accurate or current.
        </Section>

        <Section title="17) Limitation of Liability">
          To the maximum extent permitted by law, GasAround shall not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages arising from your use of the app, including but not limited to
          damages for loss of profits, data, goodwill, or other intangible
          losses resulting from: (i) your use or inability to use the app; (ii)
          any transactions between consumers and suppliers; (iii) unauthorized
          access to or alteration of your data; or (iv) any other matter
          relating to the app.
        </Section>

        <Section title="18) Termination">
          We reserve the right to suspend or terminate your account at any time
          for violation of these Terms, fraudulent activity, or for any other
          reason at our sole discretion. Upon termination, your right to use the
          app immediately ceases.
        </Section>

        <Section title="19) Changes to Terms">
          We may update these Terms from time to time to reflect changes in our
          practices or legal requirements. We will notify you of material
          changes by posting the new Terms in the app and updating the{" "}
          {"\u201C"}Last updated{"\u201D"} date. Your continued use of the app
          after such changes constitutes acceptance of the updated Terms.
        </Section>

        <Section title="20) Contact Us">
          For questions about these Terms, please contact us at
          gasaroundsupport@gmail.com. We aim to respond to all inquiries within
          48 hours.
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
