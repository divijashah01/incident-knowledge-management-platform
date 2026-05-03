export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-2xl px-4 py-3 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Sources used:</p>
                {message.sources.map((s) => (
                  <p key={s.ticket_id} className="text-xs text-blue-600">
                    {s.ticket_id} — {s.title} ({Math.round(s.similarity_score * 100)}% match)
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}