interface LoaderProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const Loader = ({ message = 'Loading...', size = 'medium', fullScreen = false }: LoaderProps) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50'
    : 'flex items-center justify-center h-64';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className="relative inline-flex">
          <div
            className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin`}
          ></div>
        </div>
        {message && (
          <p className="mt-4 text-gray-600 font-medium">{message}</p>
        )}
      </div>
    </div>
  );
};

export default Loader;
