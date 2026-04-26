import { motion } from 'framer-motion';

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  status?: 'online' | 'away' | 'offline';
  lastSeen?: Date;
}

interface PresenceAvatarProps {
  user: PresenceUser;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  showName?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-500',
};

/**
 * PresenceAvatar Component
 * Shows user presence with status indicator (for real-time collaboration)
 */
export function PresenceAvatar({
  user,
  size = 'md',
  showStatus = true,
  showName = false,
  onClick,
}: PresenceAvatarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-cyan-500',
    'bg-indigo-500',
  ];

  const bgColor = user.color || colors[user.id.charCodeAt(0) % colors.length];

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : ''} flex items-center gap-2`}
    >
      <div className="relative">
        {/* Avatar */}
        <div
          className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-semibold shadow-sm`}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Status Indicator */}
        {showStatus && user.status && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[user.status]} rounded-full border-2 border-white dark:border-neutral-900 shadow-sm`}
          />
        )}
      </div>

      {/* Name */}
      {showName && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {user.name}
          </p>
          {user.status && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
              {user.status}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

interface PresenceStackProps {
  users: PresenceUser[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (user: PresenceUser) => void;
}

/**
 * PresenceStack Component
 * Shows multiple users with overlap (for team collaboration)
 */
export function PresenceStack({
  users,
  max = 5,
  size = 'md',
  onClick,
}: PresenceStackProps) {
  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  const sizePixels = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  const overlap = sizePixels[size] * 0.4;

  return (
    <div className="flex items-center" style={{ gap: -overlap }}>
      {displayUsers.map((user, index) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          style={{ zIndex: displayUsers.length - index }}
        >
          <PresenceAvatar
            user={user}
            size={size}
            showStatus={false}
            onClick={() => onClick?.(user)}
          />
        </motion.div>
      ))}

      {remaining > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${sizePixels[size] === 32 ? 'w-8 h-8 text-xs' : sizePixels[size] === 40 ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'} bg-neutral-200 dark:bg-neutral-800 rounded-full flex items-center justify-center font-semibold text-neutral-600 dark:text-neutral-400 shadow-sm`}
          style={{ marginLeft: -overlap }}
        >
          +{remaining}
        </motion.div>
      )}
    </div>
  );
}

export default PresenceAvatar;
