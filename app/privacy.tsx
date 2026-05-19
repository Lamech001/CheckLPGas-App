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

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <FontAwesome5 name="chevron-left" size={18} color="#1976D2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: 2026-05-14</Text>

        <Text style={styles.intro}>
          This Privacy Policy explains how GasAround (“we”, “us”, “our”) collects, uses, and shares information when you use our mobile application.
        </Text>

        <Section title="1) Information we collect">
          {[
            'Account information: when you sign up, we collect your email, phone number, display name, and role (consumer/supplier).',
            'Location information: if you enable Location Services, we may use your approximate location to show nearby gas vendors. You can disable location any time from the app settings; disabling stops location-based results.',
            'Order and transaction information: when you request or manage orders, we store order details and related supplier/consumer information needed to fulfill and track requests.',
            'Device and usage information: we may collect technical and diagnostic information (e.g., app version, device type, crash logs) to maintain performance, reliability, and security.',
            'Communications & notifications: if you opt in, we may send push notifications and/or email notifications related to your account activity and order status.'
          ].join(' ')}
        </Section>


        <Section title="2) How we use your information">
          {[
            'To provide and improve the service: searching, browsing, and comparing gas vendors.',
            'To personalize experience: showing nearby vendors when location is enabled.',
            'To manage your account: authentication, access to consumer/supplier features.',
            'To send notifications: only when you opt in to the relevant notification types.',
            'To ensure safety and security: detecting issues and preventing fraud.'
          ].join(' ')}
        </Section>

        <Section title="3) When we share information">
          {[
            'Service providers: we may share information with trusted third parties that help operate the app (e.g., hosting and analytics providers).',
            'Vendors (suppliers): suppliers may view customer orders and related details only insofar as necessary to fulfill transactions.',
            'Legal requirements: we may disclose information if required by law or to protect rights, safety, and security.'
          ].join(' ')}
        </Section>

        <Section title="4) Retention">
          We retain account data for as long as your account remains active. You may request deletion of your account; when you delete your account, we attempt to delete your associated user profile and supplier listing data from our database.
        </Section>

        <Section title="5) Your choices">
          {[
            'Location: you can enable/disable Location Services in the app settings. Disabling will prevent us from using location for nearby results.',
            'Notifications: you can enable/disable push notifications and email notifications in the app settings.',
            'Account deletion: you can delete your account from Settings.'
          ].join(' ')}
        </Section>

        <Section title="6) Children’s privacy">
          Our service is not directed to children under 13 (or the relevant age in your region). We do not knowingly collect personal information from children.
        </Section>

        <Section title="7) Security">
          We use industry-standard practices to help protect information. However, no method of transmission or storage is 100% secure.
        </Section>

        <Section title="8) Contact us">
          If you have questions about this Privacy Policy, contact us via the in-app support/help section.
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

