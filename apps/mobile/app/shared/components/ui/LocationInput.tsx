import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import tw from 'twrnc';
import { MapPin, ChevronDown, X } from 'lucide-react-native';
import { getAddressSuggestionsDetailed } from '../../lib/geocode';
import { logger } from '../../lib/logger';
import { useTheme } from '../theme/ThemeProvider';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function LocationInput({
  value,
  onChange,
  placeholder = "Enter your address...",
  error,
  disabled = false
}: LocationInputProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced search function
  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const results = await getAddressSuggestionsDetailed(query);
      setSuggestions(results);
    } catch (error) {
      logger.error('Error searching addresses:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only search if query is long enough and not empty
    if (searchQuery && searchQuery.length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        searchAddresses(searchQuery);
      }, 500); // Increased debounce time to 500ms
    } else if (searchQuery.length === 0) {
      // Clear suggestions immediately when input is empty
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.display_name);
    setModalVisible(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSearchQuery('');
    setSuggestions([]);
    // Clear any pending debounced searches
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const formatSuggestion = (suggestion: Suggestion) => {
    const parts = suggestion.display_name.split(', ');
    if (parts.length > 3) {
      return parts.slice(0, 3).join(', ') + '...';
    }
    return suggestion.display_name;
  };

  const renderSuggestion = ({ item }: { item: Suggestion }) => (
    <TouchableOpacity
      style={[
        tw`p-4 border-b`,
        { borderBottomColor: colors.glassBorder }
      ]}
      onPress={() => handleSelectSuggestion(item)}
    >
      <View style={tw`flex-row items-start`}>
        <MapPin size={16} color={colors.mutedForeground} style={tw`mr-3 mt-1`} />
        <View style={tw`flex-1`}>
          <Text style={[tw`text-base`, { color: colors.foreground }]}>
            {formatSuggestion(item)}
          </Text>
          {item.address && (
            <Text style={[tw`text-sm mt-1`, { color: colors.mutedForeground }]}>
              {[
                item.address.house_number,
                item.address.road,
                item.address.city,
                item.address.state,
                item.address.postcode
              ].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={tw`space-y-2`}>
      <TouchableOpacity
        style={[
          tw`flex-row items-center justify-between p-3 rounded-xl border`,
          { 
            backgroundColor: colors.glass,
            borderColor: error ? colors.destructive : colors.glassBorder,
            opacity: disabled ? 0.5 : 1
          }
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <View style={tw`flex-1 flex-row items-center`}>
          <MapPin size={18} color={colors.mutedForeground} style={tw`mr-3`} />
          <Text 
            style={[
              tw`text-base flex-1`,
              { 
                color: value ? colors.foreground : colors.mutedForeground
              }
            ]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {error && (
        <Text style={[tw`text-sm`, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[tw`flex-row items-center justify-between p-4 border-b`, { borderColor: colors.glassBorder }]}>
            <Text style={[tw`text-lg font-semibold`, { color: colors.foreground }]}>
              Select Location
            </Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={tw`p-4`}>
            <TextInput
              style={[
                tw`p-3 rounded-xl border`,
                { 
                  backgroundColor: colors.glass,
                  borderColor: colors.glassBorder,
                  color: colors.foreground
                }
              ]}
              placeholder="Search for an address..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Suggestions List */}
          {loading ? (
            <View style={tw`flex-1 justify-center items-center`}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[tw`mt-4 text-sm`, { color: colors.mutedForeground }]}>
                Searching addresses...
              </Text>
            </View>
          ) : (
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item) => item.place_id.toString()}
              style={tw`flex-1`}
              contentContainerStyle={tw`pb-4`}
              ListEmptyComponent={
                searchQuery.length >= 3 ? (
                  <View style={tw`flex-1 justify-center items-center p-8`}>
                    <Text style={[tw`text-center text-sm`, { color: colors.mutedForeground }]}>
                      No addresses found for &quot;{searchQuery}&quot;
                    </Text>
                  </View>
                ) : (
                  <View style={tw`flex-1 justify-center items-center p-8`}>
                    <Text style={[tw`text-center text-sm`, { color: colors.mutedForeground }]}>
                      Start typing to search for addresses
                    </Text>
                  </View>
                )
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
} 