
// App.js (Expo version with markdown rendering)
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom Markdown Parser Component
const MarkdownRenderer = ({ content }) => {
  const parseMarkdown = (text) => {
    if (!text) return [];
    
    const elements = [];
    let currentIndex = 0;
    
    // Split by lines to handle block elements
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Check for code blocks (```)
      if (line.startsWith('```')) {
        const language = line.substring(3).trim();
        let codeContent = '';
        let i = lineIndex + 1;
        
        // Find closing ```
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeContent += lines[i] + '\n';
          i++;
        }
        
        if (i < lines.length) {
          elements.push({
            type: 'code',
            content: codeContent.trim(),
            language: language || '',
            key: `code-${lineIndex}`
          });
          currentIndex = i + 1;
          return;
        }
      }
      
      // Check for headings (#, ##, ###)
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        elements.push({
          type: `h${level}`,
          content: headingText,
          key: `heading-${lineIndex}`
        });
        return;
      }
      
      // Check for unordered list items
      if (line.match(/^[-*+]\s+/)) {
        const listItem = line.substring(2);
        elements.push({
          type: 'listItem',
          content: listItem,
          key: `list-${lineIndex}`
        });
        return;
      }
      
      // Check for ordered list items
      const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (orderedListMatch) {
        const listItem = orderedListMatch[2];
        elements.push({
          type: 'orderedListItem',
          content: listItem,
          number: orderedListMatch[1],
          key: `olist-${lineIndex}`
        });
        return;
      }
      
      // Check for blockquotes
      if (line.startsWith('> ')) {
        const quoteText = line.substring(2);
        elements.push({
          type: 'blockquote',
          content: quoteText,
          key: `quote-${lineIndex}`
        });
        return;
      }
      
      // Process inline elements within the line
      if (line.trim()) {
        const inlineElements = parseInlineMarkdown(line);
        elements.push({
          type: 'paragraph',
          content: inlineElements,
          key: `para-${lineIndex}`
        });
      } else {
        // Empty line for spacing
        elements.push({
          type: 'spacing',
          key: `space-${lineIndex}`
        });
      }
    });
    
    return elements;
  };
  
  const parseInlineMarkdown = (text) => {
    const elements = [];
    let currentText = '';
    let i = 0;
    
    while (i < text.length) {
      // Check for bold (**text**)
      if (text.substring(i, i + 2) === '**') {
        if (currentText) {
          elements.push({ type: 'text', content: currentText });
          currentText = '';
        }
        
        const endIndex = text.indexOf('**', i + 2);
        if (endIndex !== -1) {
          const boldText = text.substring(i + 2, endIndex);
          elements.push({ type: 'bold', content: boldText });
          i = endIndex + 2;
          continue;
        }
      }
      
      // Check for italic (*text* or _text_)
      if (text[i] === '*' || text[i] === '_') {
        if (currentText) {
          elements.push({ type: 'text', content: currentText });
          currentText = '';
        }
        
        const endIndex = text.indexOf(text[i], i + 1);
        if (endIndex !== -1 && (endIndex === i + 1 || text[endIndex - 1] !== '\\')) {
          const italicText = text.substring(i + 1, endIndex);
          elements.push({ type: 'italic', content: italicText });
          i = endIndex + 1;
          continue;
        }
      }
      
      // Check for inline code (`code`)
      if (text[i] === '`') {
        if (currentText) {
          elements.push({ type: 'text', content: currentText });
          currentText = '';
        }
        
        const endIndex = text.indexOf('`', i + 1);
        if (endIndex !== -1) {
          const codeText = text.substring(i + 1, endIndex);
          elements.push({ type: 'inlineCode', content: codeText });
          i = endIndex + 1;
          continue;
        }
      }
      
      // Check for links ([text](url))
      if (text[i] === '[') {
        if (currentText) {
          elements.push({ type: 'text', content: currentText });
          currentText = '';
        }
        
        const linkEnd = text.indexOf(']', i);
        if (linkEnd !== -1) {
          const linkText = text.substring(i + 1, linkEnd);
          const urlStart = text.indexOf('(', linkEnd);
          if (urlStart !== -1 && urlStart === linkEnd + 1) {
            const urlEnd = text.indexOf(')', urlStart);
            if (urlEnd !== -1) {
              const url = text.substring(urlStart + 1, urlEnd);
              elements.push({ 
                type: 'link', 
                content: linkText,
                url: url 
              });
              i = urlEnd + 1;
              continue;
            }
          }
        }
      }
      
      // Regular text character
      currentText += text[i];
      i++;
    }
    
    if (currentText) {
      elements.push({ type: 'text', content: currentText });
    }
    
    return elements;
  };
  
  const renderElement = (element) => {
    switch (element.type) {
      case 'h1':
        return (
          <Text key={element.key} style={styles.markdownH1}>
            {element.content}
          </Text>
        );
      case 'h2':
        return (
          <Text key={element.key} style={styles.markdownH2}>
            {element.content}
          </Text>
        );
      case 'h3':
        return (
          <Text key={element.key} style={styles.markdownH3}>
            {element.content}
          </Text>
        );
      case 'paragraph':
        return (
          <Text key={element.key} style={styles.markdownParagraph}>
            {element.content.map((inline, idx) => renderInlineElement(inline, `${element.key}-${idx}`))}
          </Text>
        );
      case 'code':
        return (
          <View key={element.key} style={styles.markdownCodeBlock}>
            {element.language ? (
              <Text style={styles.codeLanguage}>{element.language}</Text>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <Text style={styles.markdownCodeText}>
                {element.content}
              </Text>
            </ScrollView>
          </View>
        );
      case 'listItem':
        return (
          <View key={element.key} style={styles.listItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.markdownListItem}>
              {element.content}
            </Text>
          </View>
        );
      case 'orderedListItem':
        return (
          <View key={element.key} style={styles.listItem}>
            <Text style={styles.orderedNumber}>{element.number}.</Text>
            <Text style={styles.markdownListItem}>
              {element.content}
            </Text>
          </View>
        );
      case 'blockquote':
        return (
          <View key={element.key} style={styles.markdownBlockquote}>
            <Text style={styles.markdownBlockquoteText}>
              {element.content}
            </Text>
          </View>
        );
      case 'spacing':
        return <View key={element.key} style={styles.spacing} />;
      default:
        return null;
    }
  };
  
  const renderInlineElement = (inline, key) => {
    switch (inline.type) {
      case 'bold':
        return (
          <Text key={key} style={styles.markdownBold}>
            {inline.content}
          </Text>
        );
      case 'italic':
        return (
          <Text key={key} style={styles.markdownItalic}>
            {inline.content}
          </Text>
        );
      case 'inlineCode':
        return (
          <Text key={key} style={styles.markdownInlineCode}>
            {inline.content}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            style={styles.markdownLink}
            onPress={() => Linking.openURL(inline.url).catch(console.error)}
          >
            {inline.content}
          </Text>
        );
      case 'text':
        return (
          <Text key={key} style={styles.markdownText}>
            {inline.content}
          </Text>
        );
      default:
        return null;
    }
  };
  
  const elements = parseMarkdown(content);
  
  return (
    <View style={styles.markdownContainer}>
      {elements.map((element) => renderElement(element))}
    </View>
  );
};

// Main App Component
const App = () => {
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  
  const scrollViewRef = useRef();

  const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem('deepseek_api_key');
      const savedPrompt = await AsyncStorage.getItem('deepseek_system_prompt');
      
      if (savedApiKey) setApiKey(savedApiKey);
      if (savedPrompt) setSystemPrompt(savedPrompt);
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const saveApiKey = async (key) => {
    try {
      await AsyncStorage.setItem('deepseek_api_key', key);
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const saveSystemPrompt = async (prompt) => {
    try {
      await AsyncStorage.setItem('deepseek_system_prompt', prompt);
    } catch (error) {
      console.error('Error saving system prompt:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) {
      setError('Message cannot be empty');
      return;
    }

    if (!apiKey) {
      setError('Please enter your API key in Settings');
      setShowSettings(true);
      return;
    }

    const userMessage = { 
      role: 'user', 
      content: inputMessage, 
      id: Date.now(),
      isMarkdown: false 
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.map(({ role, content }) => ({ role, content }))
          ],
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        const assistantMessage = {
          role: 'assistant',
          content: data.choices[0].message.content,
          id: Date.now() + 1,
          isMarkdown: true
        };
        setMessages([...updatedMessages, assistantMessage]);
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: () => setMessages([]) }
      ]
    );
  };

  const handleApiKeyChange = (text) => {
    setApiKey(text);
    saveApiKey(text);
  };

  const handleSystemPromptChange = (text) => {
    setSystemPrompt(text);
    saveSystemPrompt(text);
  };

  const renderMessageContent = (message) => {
    if (message.role === 'user' || !message.isMarkdown) {
      return (
        <Text style={styles.messageContent}>
          {message.content}
        </Text>
      );
    }
    
    return <MarkdownRenderer content={message.content} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DeepSeek AI Assistant</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Text style={styles.settingsButtonText}>
              {showSettings ? 'Hide' : 'Settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings Panel */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingGroup}>
              <Text style={styles.label}>API Key:</Text>
              <TextInput
                style={styles.textInput}
                value={apiKey}
                onChangeText={handleApiKeyChange}
                placeholder="Enter your DeepSeek API key"
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                Get your API key from DeepSeek Platform
              </Text>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.label}>System Prompt:</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={systemPrompt}
                onChangeText={handleSystemPromptChange}
                placeholder="Define the assistant's behavior..."
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.settingActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={clearChat}
              >
                <Text style={styles.secondaryButtonText}>Clear Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.primaryButtonText}>Save & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error Display */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}>
              <Text style={styles.closeError}>×</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Start a conversation with the AI assistant.
              </Text>
              <Text style={styles.emptyStateText}>
                Configure your API key and system prompt in Settings.
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage
                ]}
              >
                <Text style={styles.messageRole}>
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </Text>
                {renderMessageContent(message)}
              </View>
            ))
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={apiKey ? "Type your message..." : "Enter API key in Settings first"}
            placeholderTextColor="#999"
            multiline
            editable={!!apiKey && !isLoading}
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={clearChat}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!apiKey || !inputMessage.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!apiKey || !inputMessage.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={[
            styles.statusIndicator,
            apiKey ? styles.statusConnected : styles.statusDisconnected
          ]}>
            <Text style={styles.statusText}>
              API: {apiKey ? 'Connected' : 'Not Connected'}
            </Text>
          </View>
          <Text style={styles.modelText}>Model: deepseek-chat</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 14,
  },
  settingsPanel: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  settingGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 6,
  },
  settingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fee',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#c33',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#c33',
    flex: 1,
  },
  closeError: {
    color: '#c33',
    fontSize: 24,
    paddingHorizontal: 8,
  },
  chatContainer: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 10,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '90%',
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: '#f8f9fa',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageRole: {
    fontWeight: '600',
    fontSize: 14,
    color: '#495057',
    marginBottom: 8,
  },
  messageContent: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
  },
  // Markdown Styles
  markdownContainer: {
    flex: 1,
  },
  markdownH1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#212529',
  },
  markdownH2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 6,
    color: '#212529',
  },
  markdownH3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
    color: '#212529',
  },
  markdownParagraph: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
    marginVertical: 4,
  },
  markdownBold: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  markdownItalic: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  markdownInlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 13,
    color: '#e83e8c',
  },
  markdownCodeBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
    overflow: 'hidden',
  },
  markdownCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#f8f9fa',
    fontSize: 13,
    lineHeight: 18,
  },
  codeLanguage: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#adb5bd',
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  markdownLink: {
    color: '#667eea',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  markdownText: {
    fontSize: 14,
    color: '#212529',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#212529',
    marginRight: 8,
    marginTop: 1,
  },
  orderedNumber: {
    fontSize: 14,
    color: '#212529',
    marginRight: 8,
    fontWeight: '500',
  },
  markdownListItem: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
    flex: 1,
  },
  markdownBlockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    paddingLeft: 12,
    marginVertical: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    paddingVertical: 8,
    paddingRight: 8,
    borderRadius: 4,
  },
  markdownBlockquoteText: {
    fontSize: 14,
    color: '#495057',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  spacing: {
    height: 8,
  },
  inputContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: 'white',
  },
  messageInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sendButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBar: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusConnected: {
    backgroundColor: '#d4edda',
  },
  statusDisconnected: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modelText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default App;

