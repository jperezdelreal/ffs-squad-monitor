import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Component crash:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0e14]">
          {/* Background gradient matching App.jsx */}
          <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />

          <div className="glass rounded-2xl border border-red-500/20 p-10 max-w-lg w-full mx-4 text-center relative z-10 shadow-2xl shadow-red-500/5">
            {/* Error icon */}
            <div className="text-6xl mb-5">💥</div>

            <h2 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              A component crashed unexpectedly. You can try again or refresh the page if the problem persists.
            </p>

            {/* Error details (collapsed) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-red-400 font-mono overflow-x-auto max-h-40 overflow-y-auto border border-white/5">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
