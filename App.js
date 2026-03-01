

import React, { useState, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Markdown from 'react-native-markdown-display';

const { width } = Dimensions.get('window');

const App = () => {
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [userMessage, setUserMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [responseHistory, setResponseHistory] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const params = {
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    max_tokens: 2048,
  };

  const callDeepSeekAPIStream = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid API key.');
      return;
    }
    if (!userMessage.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamedText('');
    setResponse('');

    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';

    const requestData = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      ...params,
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const jsonStr = line.replace('data: ', '');
              const data = JSON.parse(jsonStr);
              const content = data.choices[0]?.delta?.content || '';
              
              if (content) {
                accumulatedText += content;
                setStreamedText(accumulatedText);
              }
            } catch (e) {
              console.log('Error parsing stream chunk:', e);
            }
          }
        }
      }

      setResponse(accumulatedText);
      setResponseHistory(prev => [...prev, {
        user: userMessage,
        assistant: accumulatedText,
        timestamp: new Date().toISOString(),
      }]);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      console.error('API Error:', error);
      Alert.alert('API Error', error.message || 'Failed to call DeepSeek API.');
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    setResponseHistory([]);
    setResponse('');
    setStreamedText('');
    setUserMessage('');
  };

  const copyToClipboard = (text) => {
    // In a real app, you would use expo-clipboard or similar
    Alert.alert('Copied', 'Response copied to clipboard');
  };

  const ParameterSlider = ({ label, value, min, max, step, onValueChange }) => (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>{label}: {value.toFixed(2)}</Text>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${(value - min) / (max - min) * 100}%` }]} />
        <TextInput
          style={styles.sliderInput}
          value={value.toString()}
          onChangeText={(text) => {
            const num = parseFloat(text);
            if (!isNaN(num) && num >= min && num <= max) {
              onValueChange(num);
            }
          }}
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Icon name="api" size={32} color="#fff" />
          <Text style={styles.title}>DeepSeek API Tester</Text>
          <Text style={styles.subtitle}>Streaming Enabled</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* API Key Input */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="key" size={20} color="#667eea" />
                <Text style={styles.cardTitle}>API Configuration</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your DeepSeek API key"
                placeholderTextColor="#999"
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* System Prompt */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="settings" size={20} color="#667eea" />
                <Text style={styles.cardTitle}>System Prompt</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter system prompt"
                placeholderTextColor="#999"
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Parameters */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="tune" size={20} color="#667eea" />
                <Text style={styles.cardTitle}>Model Parameters</Text>
              </View>
              <ParameterSlider
                label="Temperature"
                value={params.temperature}
                min={0}
                max={2}
                step={0.1}
                onValueChange={(val) => params.temperature = val}
              />
              <ParameterSlider
                label="Top P"
                value={params.top_p}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(val) => params.top_p = val}
              />
            </View>

            {/* User Input */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon name="message" size={20} color="#667eea" />
                <Text style={styles.cardTitle}>Your Message</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Type your message here..."
                placeholderTextColor="#999"
                value={userMessage}
                onChangeText={setUserMessage}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={callDeepSeekAPIStream}
                disabled={loading || isStreaming}
              >
                {loading || isStreaming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="send" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Stream Response</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={clearChat}
              >
                <Icon name="delete" size={20} color="#fff" />
                <Text style={styles.buttonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Response Display */}
            {(response || isStreaming) && (
              <Animated.View
                style={[
                  styles.card,
                  styles.responseCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Icon name="smart-toy" size={20} color="#4CAF50" />
                  <Text style={styles.cardTitle}>AI Response</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(response || streamedText)}
                  >
                    <Icon name="content-copy" size={18} color="#667eea" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.responseContainer}>
                  {isStreaming ? (
                    <View style={styles.streamingContainer}>
                      <Text style={styles.streamingText}>{streamedText}</Text>
                      <View style={styles.typingIndicator}>
                        <View style={styles.typingDot} />
                        <View style={styles.typingDot} />
                        <View style={styles.typingDot} />
                      </View>
                    </View>
                  ) : (
                    <Markdown style={markdownStyles}>
                      {response}
                    </Markdown>
                  )}
                </ScrollView>
                
                <View style={styles.responseFooter}>
                  <Text style={styles.tokenCount}>
                    Tokens: {response?.length || streamedText?.length || 0}
                  </Text>
                  {isStreaming && (
                    <View style={styles.streamingBadge}>
                      <Icon name="sync" size={14} color="#fff" />
                      <Text style={styles.streamingBadgeText}>Streaming</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Chat History */}
            {responseHistory.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Icon name="history" size={20} color="#667eea" />
                  <Text style={styles.cardTitle}>Chat History</Text>
                  <Text style={styles.historyCount}>
                    {responseHistory.length} conversations
                  </Text>
                </View>
                {responseHistory.slice(-3).map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.historyItem}
                    onPress={() => {
                      setUserMessage(item.user);
                      setResponse(item.assistant);
                    }}
                  >
                    <Text style={styles.historyUser} numberOfLines={1}>
                      <Icon name="person" size={14} color="#667eea" /> {item.user}
                    </Text>
                    <Text style={styles.historyAssistant} numberOfLines={1}>
                      <Icon name="smart-toy" size={14} color="#4CAF50" /> {item.assistant.substring(0, 50)}...
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const markdownStyles = {
  body: {
    color: '#333',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: '#667eea',
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  heading2: {
    color: '#764ba2',
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inline_code: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  sliderInput: {
    position: 'absolute',
    right: 0,
    top: -30,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  responseCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  responseContainer: {
    maxHeight: 300,
    minHeight: 150,
  },
  streamingContainer: {
    padding: 4,
  },
  streamingText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  typingDot: {
    width: 8,
    height: 8,
    backgroundColor: '#667eea',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  copyButton: {
    padding: 8,
  },
  responseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  tokenCount: {
    fontSize: 12,
    color: '#666',
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streamingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  streamingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  historyCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyAssistant: {
    fontSize: 12,
    color: '#666',
  },
});

export default App;
