import { AppStatusBar } from '@/components/AppStatusBar';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <FontAwesome5 name="chevron-left" size={18} color="#1976D2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: June 17, 2026</Text>

        <Text style={styles.intro}>
          Welcome to GasAround, a mobile application that helps consumers find and compare cooking gas prices from nearby suppliers. These Terms of Service govern your use of the GasAround app. By using the app, you agree to these Terms.
        </Text>

        <Section title="1) Acceptance of Terms">
          By downloading, accessing, or using the GasAround app, you agree to be bound by these Terms of Service. If you do not agree to these Terms, please do not use the app.
        </Section>

        <Section title="2) Account Registration">
          To use certain features of the app, you must register for an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
        </Section>

        <Section title="3) Consumer Use">
          As a consumer, you may use the app to search for gas suppliers, compare prices, view supplier information, and place orders. You agree to use the app only for legitimate purposes and not for any fraudulent or illegal activities.
        </Section>

        <Section title="4) Supplier Use">
          As a supplier, you may list your gas business, set prices, manage orders, and communicate with consumers. You agree to provide accurate information about your business, prices, and availability. You are solely responsible for fulfilling orders placed through the app.
        </Section>

        <Section title="5) Orders and Transactions">
          All orders placed through the app are between you (the consumer) and the supplier. GasAround is not a party to these transactions and does not guarantee delivery, quality, or availability of gas cylinders. Payment terms are agreed upon directly between you and the supplier.
        </Section>

        <Section title="6) Location Services">
          The app may use your location to show nearby gas suppliers. You can enable or disable location services in your device settings. Disabling location services may limit the app's functionality.
        </Section>

        <Section title="7) User Content">
          You are responsible for any content you submit to the app, including business information, prices, reviews, and communications. You agree not to submit content that is illegal, harmful, threatening, abusive, or misleading.
        </Section>

        <Section title="8) Reviews and Ratings">
          Consumers may leave reviews and ratings for suppliers. Reviews must be honest and based on actual experiences. Suppliers may not post fake reviews or manipulate ratings.
        </Section>

        <Section title="9) Notifications">
          The app may send you push notifications about orders, messages, and other relevant information. You can manage your notification preferences in the app settings.
        </Section>

        <Section title="10) Intellectual Property">
          The GasAround app, its design, and all content are owned by GasAround and are protected by intellectual property laws. You may not copy, modify, or distribute the app without permission.
        </Section>

        <Section title="11) Privacy">
          Your use of the app is also governed by our Privacy Policy, which explains how we collect, use, and protect your information.
        </Section>

        <Section title="12) Disclaimers">
          The app is provided "as is" without warranties of any kind. We do not guarantee that the app will be error-free, secure, or uninterrupted. We do not guarantee the accuracy of supplier information, prices, or availability.
        </Section>

        <Section title="13) Limitation of Liability">
          To the maximum extent permitted by law, GasAround shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app, including but not limited to damages for loss of profits, data, or other intangible losses.
        </Section>

        <Section title="14) Termination">
          We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion.
        </Section>

        <Section title="15) Changes to Terms">
          We may update these Terms from time to time. We will notify you of material changes by posting the new Terms in the app. Your continued use of the app after such changes constitutes acceptance of the updated Terms.
        </Section>

        <Section title="16) Contact Us">
          For questions about these Terms, please contact us at gasaroundsupport@gmail.com
        </Section>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  content: { paddingHorizontal: 16, paddingVertical: 14 },
  lastUpdated: { fontSize: 12, color: '#777', marginBottom: 10 },
  intro: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 16, fontWeight: '500' },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1976D2', marginBottom: 6 },
  paragraph: { fontSize: 13, color: '#333', lineHeight: 20 },
});

