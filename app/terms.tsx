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
        <Text style={styles.lastUpdated}>Last updated: 2026-05-14</Text>

        <Text style={styles.intro}>
          These Terms of Service govern your use of GasAround (“Service”). By using the app, you agree to these Terms.
        </Text>

        <Section title="1) Use of the Service">
          You agree to use the Service only for lawful purposes and in accordance with these Terms. You are responsible for your account activity.
        </Section>

        <Section title="2) Accounts and eligibility">
          You must provide accurate information during registration. We may suspend or terminate accounts that violate these Terms or engage in fraudulent activity.
        </Section>

        <Section title="3) Locations and vendor listings">
          Location-based results and vendor availability are provided for convenience and may change. We do not guarantee the accuracy or completeness of vendor listings.
        </Section>

        <Section title="4) User content">
          Suppliers may provide listing information. You are responsible for the content you submit. You must not post illegal, misleading, or harmful content.
        </Section>

        <Section title="5) Notifications">
          By enabling notifications in the app, you agree that we may send you service-related notifications. You may disable notifications at any time in app settings.
        </Section>

        <Section title="6) Privacy">
          Our Privacy Policy explains how we collect and use information. By using the app, you agree to our Privacy Policy.
        </Section>

        <Section title="7) Payments & transactions">
          If your use involves any transactions, those transactions are between you and the relevant supplier. We are not a party to the transaction unless expressly stated.
        </Section>

        <Section title="8) Disclaimers">
          The Service is provided “as is” and “as available”. We do not warrant that the Service will be uninterrupted or error-free.
        </Section>

        <Section title="9) Limitation of liability">
          To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages arising from your use of the Service.
        </Section>

        <Section title="10) Termination">
          We may suspend or terminate your access if you violate these Terms or if required by law.
        </Section>

        <Section title="11) Contact">
          For questions about these Terms, contact us via the in-app support/help section.
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

