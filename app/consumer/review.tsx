import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { addReview, hasReviewedOrder } from '@/services/reviewService';
import { getStarLabel, STAR_LABELS } from '@/services/types/review';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const supplierId = params.supplierId as string;
  const supplierName = params.supplierName as string || 'Supplier';

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    const checkExistingReview = async () => {
      if (orderId) {
        const hasReview = await hasReviewedOrder(orderId);
        setAlreadyReviewed(hasReview);
      }
    };
    checkExistingReview();
  }, [orderId]);

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please sign in to submit a review');
      return;
    }

    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    setLoading(true);

    const result = await addReview({
      orderId,
      consumerId: currentUser.uid,
      consumerName: currentUser.displayName || 'Anonymous',
      supplierId,
      rating,
      comment: comment.trim(),
    });

    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Review Submitted!',
        'Thank you for your feedback. Your review helps other customers make better choices.',
        [
          {
            text: 'View Orders',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to submit review');
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={styles.starButton}
            onPress={() => setRating(star)}
          >
            <FontAwesome5
              name={star <= rating ? 'star' : 'star-o'}
              size={40}
              color={star <= rating ? '#FFC107' : '#ddd'}
              solid={star <= rating}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#4CAF50" barStyle="light-content" />
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="user-lock" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Please sign in to submit a review</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/consumer/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (alreadyReviewed) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#4CAF50" barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Submitted</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.alreadyReviewedContainer}>
          <FontAwesome5 name="check-circle" size={64} color="#4CAF50" />
          <Text style={styles.alreadyReviewedTitle}>Already Reviewed!</Text>
          <Text style={styles.alreadyReviewedText}>
            You have already submitted a review for this order.
          </Text>
          <TouchableOpacity style={styles.viewOrdersButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.viewOrdersButtonText}>View Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#4CAF50" barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <FontAwesome5 name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rate Your Order</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Supplier Info */}
          <View style={styles.supplierCard}>
            <FontAwesome5 name="store" size={32} color="#4CAF50" />
            <Text style={styles.supplierName}>{supplierName}</Text>
            <Text style={styles.supplierLabel}>How was your experience?</Text>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.sectionTitle}>Tap to Rate</Text>
            {renderStars()}
            {rating > 0 && (
              <Text style={styles.ratingLabel}>{getStarLabel(rating)}</Text>
            )}
          </View>

          {/* Comment Section */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionTitle}>Write a Review (Optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience with this supplier..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>{comment.length}/500</Text>
          </View>

          {/* Rating Guide */}
          <View style={styles.guideSection}>
            <Text style={styles.guideTitle}>Rating Guide</Text>
            {[5, 4, 3, 2, 1].map((star) => (
              <View key={star} style={styles.guideRow}>
                <View style={styles.guideStars}>
                  {[...Array(star)].map((_, i) => (
                    <FontAwesome5 key={i} name="star" size={12} color="#FFC107" solid />
                  ))}
                </View>
                <Text style={styles.guideLabel}>{STAR_LABELS[star]}</Text>
              </View>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || loading}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Review</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  supplierCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supplierName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginTop: 12,
  },
  supplierLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  ratingSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 12,
  },
  commentSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212121',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  guideSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  guideStars: {
    flexDirection: 'row',
    gap: 2,
    width: 80,
  },
  guideLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  alreadyReviewedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alreadyReviewedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 16,
  },
  alreadyReviewedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  viewOrdersButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewOrdersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
