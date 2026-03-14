import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/store'
import { slideInRight, springPresets } from '../lib/motion'

const ALERT_TYPE_LABELS = {
  agentBlocked: 'Agent blocked',
  heartbeatStale: 'Heartbeat stale',
  buildFailed: 'Build failed',
  rateLimitWarning: 'Rate limit warning',
  issueSpike: 'Issue spike',
  sprintMilestone: 'Sprint milestone',
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer group">
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
          checked ? 'bg-cyan-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function SliderInput({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-xs font-mono text-cyan-400">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-cyan-500 cursor-pointer"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-500">{min}{unit}</span>
        <span className="text-[10px] text-gray-500">{max}{unit}</span>
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2 first:mt-0">{children}</h3>
  )
}

export function Settings() {
  const panelRef = useRef(null)
  const show = useStore(s => s.showSettingsPanel)
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const updateAlertType = useStore(s => s.updateAlertType)
  const closeAllPanels = useStore(s => s.closeAllPanels)

  // Close on Escape
  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Escape') closeAllPanels() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, closeAllPanels])

  // Close on outside click
  useEffect(() => {
    if (!show) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closeAllPanels()
      }
    }
    // Delay listener to avoid closing immediately from the button click
    const timer = setTimeout(() => document.addEventListener('mousedown', onClick), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onClick)
    }
  }, [show, closeAllPanels])

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            variants={slideInRight}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springPresets.snappy}
            className="fixed left-72 top-0 bottom-0 w-96 z-50 glass border-r border-white/10 overflow-y-auto"
          >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <motion.span 
                className="text-xl"
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              >
                ⚙️
              </motion.span>
              <h2 className="text-lg font-bold text-white">Settings</h2>
            </div>
            <motion.button
              onClick={closeAllPanels}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={springPresets.snappy}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close settings"
            >
              ✕
            </motion.button>
          </div>

          {/* Notification Preferences */}
          <SectionHeader>Notification Preferences</SectionHeader>
          <div className="space-y-0.5">
            {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => (
              <Toggle
                key={key}
                label={label}
                checked={settings.alertTypes[key]}
                onChange={(val) => updateAlertType(key, val)}
              />
            ))}
          </div>

          <div className="h-px bg-white/10 my-4" />

          <Toggle
            label="Enable notification sounds"
            checked={settings.soundEnabled}
            onChange={(val) => updateSettings({ soundEnabled: val })}
          />
          <Toggle
            label="Enable desktop notifications"
            checked={settings.desktopEnabled}
            onChange={(val) => updateSettings({ desktopEnabled: val })}
          />

          {/* Threshold Configuration */}
          <SectionHeader>Threshold Configuration</SectionHeader>
          <SliderInput
            label="Heartbeat staleness"
            value={settings.stalenessThresholdMin}
            onChange={(val) => updateSettings({ stalenessThresholdMin: val })}
            min={1}
            max={30}
            unit=" min"
          />
          <SliderInput
            label="Rate limit warning"
            value={settings.rateLimitThreshold}
            onChange={(val) => updateSettings({ rateLimitThreshold: val })}
            min={50}
            max={500}
            step={10}
          />
          <div className="py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-300">Issue spike threshold</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.issueSpikeCount}
                onChange={(e) => updateSettings({ issueSpikeCount: Math.max(1, Number(e.target.value)) })}
                className="w-16 px-2 py-1 rounded bg-gray-800 border border-white/10 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <span className="text-xs text-gray-400">issues in</span>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.issueSpikeWindowMin}
                onChange={(e) => updateSettings({ issueSpikeWindowMin: Math.max(1, Number(e.target.value)) })}
                className="w-16 px-2 py-1 rounded bg-gray-800 border border-white/10 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <span className="text-xs text-gray-400">min</span>
            </div>
          </div>

          {/* Display Preferences */}
          <SectionHeader>Display Preferences</SectionHeader>
          <div className="py-2">
            <span className="text-sm text-gray-300 block mb-2">Polling interval</span>
            <div className="flex gap-2">
              {pollingOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateSettings({ pollingInterval: opt })}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    settings.pollingInterval === opt
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt}s
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Dashboard auto-refresh"
            checked={settings.autoRefresh}
            onChange={(val) => updateSettings({ autoRefresh: val })}
          />
        </div>
      </motion.div>
      </>
      )}
    </AnimatePresence>
  )
}
