/**
 * Rate Supplier Modal - Allow consumers to rate and review suppliers
 * Features: 5-star rating, optional text review, submit/edit/delete ratings
 */

import { RatingInput, StarRating } from '@/components/StarRating';
import { auth } from '@/config/firebase';
import { 
  deleteRating, 
  hasConsumerRated, 
  submitRating,
  type RatingData 
} from '@/services/ratingsService';
import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface RateSupplierModalProps {
  visible: boolean;
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onRatingSubmitted?: () => void;
}

export function RateSupplierModal({
  visible,
  supplierId,
  supplierName,
  onClose,
  onRatingSubmitted,
}: RateSupplierModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingRating, setExistingRating] = useState<RatingData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const user = auth.currentUser;

  // Check if user has already rated this supplier
  useEffect(() => {
    if (!visible || !user || !supplierId) {
      setChecking(false);
      return;
    }

    const checkExisting = async () => {
      setChecking(true);
      try {
        const result = await hasConsumerRated(supplierId, user.uid);
        if (result.success && result.rated && result.rating) {
          setExistingRating(result.rating);
          setRating(result.rating.rating);
          setReview(result.rating.review || '');
        } else {
          setExistingRating(null);
          setRating(0);
          setReview('');
        }
      } catch (error) {
        console.error('Error checking existing rating:', error);
      } finally {
        setChecking(false);
      }
    };

    checkExisting();
  }, [visible, supplierId, user]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to rate');
      return;
    }

    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitRating(
        supplierId,
        user.uid,
        user.displayName || 'Anonymous',
        rating,
        review.trim() || undefined
      );

      if (result.success) {
        Alert.alert(
          'Success',
          existingRating ? 'Your rating has been updated!' : 'Thank you for your rating!',
          [{ text: 'OK', onPress: () => {
            onRatingSubmitted?.();
            onClose();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit rating');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    Alert.alert(
      'Delete Rating',
      'Are you sure you want to delete your rating?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await deleteRating(supplierId, user.uid);
              if (result.success) {
                Alert.alert('Deleted', 'Your rating has been removed');
                onRatingSubmitted?.();
                onClose();
              } else {
                Alert.alert('Error', result.error || 'Failed to delete rating');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete rating');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Rate {supplierName}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <FontAwesome5 name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {checking ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1976D2" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Existing Rating Notice */}
                {existingRating && (
                  <View style={styles.existingNotice}>
                    <FontAwesome5 name="info-circle" size={16} color="#1976D2" />
                    <Text style={styles.existingText}>
                      You rated this supplier {existingRating.rating} stars on{' '}
                      {existingRating.createdAt?.toDate?.().toLocaleDateString() || 'a previous visit'}
                    </Text>
                  </View>
                )}

                {/* Rating Input */}
                <View style={styles.ratingSection}>
                  <Text style={styles.sectionLabel}>
                    {existingRating ? 'Update your rating:' : 'How was your experience?'}
                  </Text>
                  <RatingInput
                    initialRating={rating}
                    onRatingChange={setRating}
                    size={40}
                  />
                </View>

                {/* Review Input */}
                <View style={styles.reviewSection}>
                  <Text style={styles.sectionLabel}>
                    Share your experience (optional):
                  </Text>
                  <TextInput
                    style={styles.reviewInput}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    placeholder="Tell others about your experience with this supplier..."
                    placeholderTextColor="#9CA3AF"
                    value={review}
                    onChangeText={setReview}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>{review.length}/500</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  {existingRating && (
                    <TouchableOpacity
                      style={[styles.button, styles.deleteButton]}
                      onPress={handleDelete}
                      disabled={submitting || loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#f44336" />
                      ) : (
                        <>
                          <FontAwesome5 name="trash" size={16} color="#f44336" style={styles.buttonIcon} />
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.submitButton,
                      (rating === 0 || submitting) && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={rating === 0 || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <FontAwesome5 
                          name={existingRating ? 'edit' : 'check'} 
                          size={16} 
                          color="#fff" 
                          style={styles.buttonIcon} 
                        />
                        <Text style={styles.submitButtonText}>
                          {existingRating ? 'Update Rating' : 'Submit Rating'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface SupplierRatingBadgeProps {
  rating: number;
  totalRatings: number;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export function SupplierRatingBadge({
  rating,
  totalRatings,
  size = 'medium',
  onPress,
}: SupplierRatingBadgeProps) {
  const sizeConfig = {
    small: { starSize: 12, fontSize: 12 },
    medium: { starSize: 16, fontSize: 14 },
    large: { starSize: 20, fontSize: 16 },
  };

  const config = sizeConfig[size];

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper 
      style={styles.badgeContainer}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <FontAwesome5 name="star" size={config.starSize} color="#F59E0B" solid />
      <Text style={[styles.badgeRating, { fontSize: config.fontSize }]}>
        {rating.toFixed(1)}
      </Text>
      {totalRatings > 0 && (
        <Text style={[styles.badgeCount, { fontSize: config.fontSize - 2 }]}>
          ({totalRatings})
        </Text>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
  },
  existingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  existingText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#1976D2',
    flex: 2,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeRating: {
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 2,
  },
  badgeCount: {
    color: '#9CA3AF',
  },
});
