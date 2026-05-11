/**
 * Star Rating Component - Display and interact with 5-star ratings
 * Features: Display rating, interactive rating input, half-star support
 */

import { FontAwesome5 } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface StarRatingProps {
  rating: number; // 0-5, supports decimals (e.g., 4.5)
  maxStars?: number;
  size?: number;
  color?: string;
  emptyColor?: string;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showValue?: boolean;
  style?: ViewStyle;
  totalRatings?: number; // Show "(42)" next to rating
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 20,
  color = '#F59E0B', // Amber-500
  emptyColor = '#D1D5DB', // Gray-300
  interactive = false,
  onRatingChange,
  showValue = false,
  style,
  totalRatings,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const displayRating = hoverRating || rating;

  const handlePress = (starIndex: number) => {
    if (!interactive || !onRatingChange) return;
    onRatingChange(starIndex);
  };

  const handlePressIn = (starIndex: number) => {
    if (!interactive) return;
    setHoverRating(starIndex);
  };

  const handlePressOut = () => {
    if (!interactive) return;
    setHoverRating(0);
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFilled = displayRating >= starValue;
    const isHalf = displayRating >= starValue - 0.5 && displayRating < starValue;

    let iconName: string;
    if (isFilled) {
      iconName = 'star';
    } else if (isHalf) {
      iconName = 'star-half-alt';
    } else {
      iconName = 'star';
    }

    const starColor = isFilled || isHalf ? color : emptyColor;

    return (
      <TouchableOpacity
        key={index}
        activeOpacity={interactive ? 0.7 : 1}
        onPress={() => handlePress(starValue)}
        onPressIn={() => handlePressIn(starValue)}
        onPressOut={handlePressOut}
        disabled={!interactive}
        style={styles.starContainer}
      >
        <FontAwesome5
          name={iconName}
          size={size}
          color={starColor}
          solid={isFilled || isHalf}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.starsContainer}>
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </View>
      
      {showValue && (
        <Text style={[styles.ratingText, { fontSize: size * 0.7 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
      
      {totalRatings !== undefined && totalRatings > 0 && (
        <Text style={[styles.totalText, { fontSize: size * 0.65 }]}>
          ({totalRatings})
        </Text>
      )}
    </View>
  );
}

interface RatingInputProps {
  initialRating?: number;
  onRatingChange: (rating: number) => void;
  size?: number;
  label?: string;
}

export function RatingInput({
  initialRating = 0,
  onRatingChange,
  size = 32,
  label = 'Tap to rate:',
}: RatingInputProps) {
  const [selectedRating, setSelectedRating] = useState(initialRating);

  const handleRatingChange = (rating: number) => {
    setSelectedRating(rating);
    onRatingChange(rating);
  };

  const getRatingLabel = (rating: number): string => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return '';
    }
  };

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <StarRating
        rating={selectedRating}
        interactive
        onRatingChange={handleRatingChange}
        size={size}
        color="#F59E0B"
        style={styles.inputStars}
      />
      
      {selectedRating > 0 && (
        <Text style={[styles.ratingLabel, { color: getRatingColor(selectedRating) }]}>
          {getRatingLabel(selectedRating)}
        </Text>
      )}
    </View>
  );
}

const getRatingColor = (rating: number): string => {
  switch (rating) {
    case 1: return '#EF4444'; // Red
    case 2: return '#F97316'; // Orange
    case 3: return '#EAB308'; // Yellow
    case 4: return '#22C55E'; // Green
    case 5: return '#16A34A'; // Dark Green
    default: return '#6B7280';
  }
};

interface RatingBreakdownProps {
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  total: number;
}

export function RatingBreakdown({ distribution, total }: RatingBreakdownProps) {
  if (total === 0) {
    return (
      <View style={styles.breakdownContainer}>
        <Text style={styles.noRatingsText}>No ratings yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.breakdownContainer}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star as keyof typeof distribution];
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <View key={star} style={styles.breakdownRow}>
            <Text style={styles.starLabel}>{star} star</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${percentage}%` },
                ]}
              />
            </View>
            <Text style={styles.countLabel}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starContainer: {
    marginHorizontal: 2,
  },
  ratingText: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#374151',
  },
  totalText: {
    marginLeft: 4,
    color: '#6B7280',
  },
  inputContainer: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  inputStars: {
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  breakdownContainer: {
    width: '100%',
  },
  noRatingsText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  starLabel: {
    width: 45,
    fontSize: 12,
    color: '#6B7280',
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  countLabel: {
    width: 30,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
});
