import { WifiIcon } from '@heroicons/react/24/outline';

export default function OfflinePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full">
          <WifiIcon className="w-10 h-10 text-gray-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          You're Offline
        </h1>
        
        <p className="text-gray-400 mb-8">
          Squad Monitor requires an internet connection to fetch live data. 
          Please check your connection and try again.
        </p>

        <button
          onClick={handleReload}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>

        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-left">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">
            Troubleshooting Tips:
          </h2>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Check your Wi-Fi or mobile data connection</li>
            <li>• Verify that airplane mode is disabled</li>
            <li>• Try refreshing the page</li>
            <li>• Restart your browser if the issue persists</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
