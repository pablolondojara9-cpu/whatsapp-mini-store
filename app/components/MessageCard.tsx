type MessageCardProps = {
  sender: string;
  message: string;
  time: string;
};

export default function MessageCard({
  sender,
  message,
  time,
}: MessageCardProps) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-800 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900 text-green-300">
        {sender.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-white">
            {sender}
          </p>

          <span className="text-xs text-zinc-500">
            {time}
          </span>
        </div>

        <p className="mt-1 text-sm text-zinc-400">
          {message}
        </p>
      </div>
    </div>
  );
}