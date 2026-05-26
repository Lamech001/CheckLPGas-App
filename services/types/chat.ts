// Chat/Messaging Types

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'consumer' | 'supplier';
  text: string;
  originalText?: string;
  timestamp: Date;
  read: boolean;
  isEdited?: boolean;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  consumerId: string;
  consumerName: string;
  consumerPhone?: string;
  consumerLiveLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  consumerLiveLocationUpdatedAt?: Date;
  /** True while consumer is actively sharing; false keeps last saved coords for offline lookup */
  consumerLiveLocationSharing?: boolean;
  supplierId: string;
  supplierName: string;
  supplierEnterpriseName: string;
  lastMessage?: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  unreadCount: number;
  supplierUnreadCount?: number;
  consumerUnreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageData {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'consumer' | 'supplier';
  text: string;
}

export interface CreateConversationData {
  consumerId: string;
  consumerName: string;
  consumerPhone?: string;
  supplierId: string;
  supplierName: string;
  supplierEnterpriseName: string;
}

export const formatMessageTime = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  return messageDate.toLocaleDateString('en-KE', { 
    day: 'numeric', 
    month: 'short' 
  });
};

export const formatChatDate = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);
  const isToday = messageDate.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === messageDate.toDateString();
  
  if (isToday) {
    return messageDate.toLocaleTimeString('en-KE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  if (isYesterday) return 'Yesterday';
  
  return messageDate.toLocaleDateString('en-KE', { 
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
};
