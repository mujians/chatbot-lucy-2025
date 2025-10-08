import React from 'react';

const ChatMessage = ({ message, operatorName }) => {
  const { type, content, timestamp } = message;

  const getMessageStyle = () => {
    switch (type) {
      case 'user':
        return {
          align: 'justify-end',
          bg: 'bg-gradient-to-br from-christmas-green to-green-600',
          text: 'text-white',
          radius: 'rounded-2xl rounded-br-md',
        };
      case 'operator':
        return {
          align: 'justify-start',
          bg: 'bg-gradient-to-br from-green-700 to-green-800',
          text: 'text-white',
          radius: 'rounded-2xl rounded-bl-md',
          border: 'border-l-4 border-christmas-green',
        };
      case 'ai':
        return {
          align: 'justify-start',
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          radius: 'rounded-2xl rounded-bl-md',
          border: 'border border-gray-200',
        };
      case 'system':
        return {
          align: 'justify-center',
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          radius: 'rounded-lg',
          border: 'border border-blue-200',
        };
      default:
        return {};
    }
  };

  const style = getMessageStyle();
  const time = new Date(timestamp).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (type === 'system') {
    return (
      <div className={`flex ${style.align} my-2`}>
        <div
          className={`${style.bg} ${style.text} ${style.radius} ${style.border} px-4 py-2 text-xs text-center max-w-[80%]`}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${style.align} my-3`}>
      <div className="max-w-[80%]">
        {type === 'operator' && operatorName && (
          <div className="text-xs text-gray-600 mb-1 font-medium">
            {operatorName}
          </div>
        )}
        <div
          className={`${style.bg} ${style.text} ${style.radius} ${style.border} px-4 py-3 shadow-sm`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          <span className="text-xs opacity-70 mt-1 block">{time}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
