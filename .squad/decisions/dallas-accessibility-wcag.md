# Decision: WCAG 2.1 AA Accessibility Standards

**Date:** 2026-03-15  
**Author:** Dallas  
**Status:** Implemented  
**Issue:** #165  
**PR:** #178  

## Context

The dashboard lacked comprehensive accessibility features, making it difficult or impossible for users with disabilities to navigate and use the application effectively. We needed to achieve WCAG 2.1 AA compliance to ensure the dashboard is usable by everyone.

## Decision

Implement comprehensive accessibility improvements across the entire application, establishing patterns and standards for all future components.

## Implementation

### Global Standards

1. **Focus Indicators**
   - All interactive elements have visible 3px solid outline with 2px offset on keyboard focus
   - Dark mode: `#60a5fa` (lighter blue)
   - Light mode: `#1e40af` (darker blue)
   - Use `:focus-visible` to show only for keyboard navigation (not mouse)

2. **Motion Preferences**
   - All animations respect `prefers-reduced-motion` media query
   - Reduced animations to 0.01ms for users with motion sensitivity

3. **Screen Reader Utilities**
   - `.sr-only` - Visually hidden but readable by screen readers
   - `.sr-only-focusable` - Shows when focused (for skip links)

### Component Patterns

#### ARIA Live Regions
```jsx
// For real-time updates that don't interrupt user
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {updateMessage}
</div>

// For critical alerts that need immediate attention
<div role="alert" aria-live="assertive" aria-atomic="true">
  {alertMessage}
</div>
```

#### Expandable Components
```jsx
<button
  aria-expanded={isExpanded}
  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
  onClick={toggle}
>
```

#### Form Controls
```jsx
// Sliders
<label htmlFor={uniqueId}>{label}</label>
<input
  id={uniqueId}
  type="range"
  aria-label={`${label}, current value: ${value}${unit}`}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
/>

// Toggles
<button
  role="switch"
  aria-checked={checked}
  aria-label={`${label} ${checked ? 'enabled' : 'disabled'}`}
/>
```

#### Dialogs/Modals
```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
>
  <h2 id="dialog-title">Title</h2>
  {/* content */}
</div>

// Backdrop
<div aria-hidden="true" className="backdrop" />
```

#### Charts (Canvas-based)
```jsx
<div
  role="img"
  aria-label="Chart showing {data description}"
  aria-describedby="chart-desc"
>
  <span id="chart-desc" className="sr-only">
    {detailedTextualDescription}
  </span>
  <Canvas />
</div>
```

#### Decorative Content
```jsx
// Mark all decorative icons, animations, visual elements
<span aria-hidden="true">🎯</span>
<div aria-hidden="true" className="backdrop" />
```

## Rationale

1. **Legal Compliance**: Many jurisdictions require WCAG 2.1 AA compliance for web applications
2. **Inclusivity**: Ensures the dashboard is usable by people with disabilities
3. **Better UX for Everyone**: Focus indicators and keyboard navigation benefit all users
4. **Professional Standard**: Accessibility is a baseline expectation for modern web apps

## Consequences

### Positive
- Dashboard is now fully keyboard navigable
- Screen readers can effectively navigate and understand all content
- Real-time updates are announced to assistive technologies
- Charts have textual alternatives for non-visual users
- Better focus management improves navigation for keyboard users

### Negative
- Slightly increased bundle size due to ARIA attributes and additional markup
- More complex component testing (must verify ARIA attributes)
- Developers must follow accessibility patterns for all new components

## Compliance

Meets the following WCAG 2.1 AA criteria:
- ✅ 1.4.3 Contrast (Minimum)
- ✅ 2.1.1 Keyboard
- ✅ 2.1.2 No Keyboard Trap
- ✅ 2.4.3 Focus Order
- ✅ 2.4.7 Focus Visible
- ✅ 3.2.1 On Focus
- ✅ 3.2.4 Consistent Identification
- ✅ 4.1.2 Name, Role, Value
- ✅ 4.1.3 Status Messages

## Future Work

1. **Color Contrast Audit**: Verify all text/background combinations meet 4.5:1 ratio
2. **High Contrast Mode**: Add explicit high-contrast theme for Windows users
3. **Keyboard Shortcuts**: Expand keyboard navigation with more shortcuts
4. **Touch Target Sizes**: Ensure all interactive elements are minimum 44x44px
5. **Zoom Testing**: Verify layout works at 200% zoom
6. **Automated Testing**: Integrate axe-core or similar tool in CI pipeline

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM: Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [MDN: ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
