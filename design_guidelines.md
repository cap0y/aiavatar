# Discord-Style Chat Application Design Guidelines

## Design Approach
**Reference-Based Approach**: Following Discord's design patterns for familiarity and optimal chat experience. Discord's interface prioritizes functionality while maintaining visual appeal through strategic use of dark themes and accent colors.

## Core Design Elements

### Color Palette
**Dark Mode Primary** (Discord's signature dark theme):
- Background: 220 13% 18% (main background)
- Secondary: 220 13% 15% (sidebar/panels)
- Surface: 220 13% 22% (chat messages area)
- Text Primary: 220 9% 89%
- Text Secondary: 220 9% 69%

**Brand Colors**:
- Primary: 235 85% 64% (Discord's blurple)
- Success: 139 47% 57% (online status)
- Warning: 38 95% 54% (away status)
- Danger: 359 82% 59% (offline/error)

### Typography
**Font Stack**: Inter via Google Fonts CDN
- Headers: 600 weight, 1.2 line-height
- Body text: 400 weight, 1.5 line-height
- Chat messages: 400 weight, 1.4 line-height
- UI labels: 500 weight

### Layout System
**Tailwind Spacing**: Use consistent spacing units of 2, 4, and 8 (p-2, h-8, m-4, etc.)
- Consistent 4-unit spacing for most UI elements
- 8-unit spacing for major section separation
- 2-unit spacing for tight layouts like message lists

### Component Library

**Navigation**:
- Fixed left sidebar (16rem width) with server/channel list
- Three-column layout: servers | channels | chat area
- Collapsible channel categories with chevron indicators

**Chat Interface**:
- Message bubbles with user avatars (8x8 units)
- Timestamp on hover, username with role colors
- Message input with rounded corners and emoji picker
- Typing indicators at bottom of message area

**User Interface**:
- Rounded profile pictures (full rounded)
- Status indicators (small colored dots)
- Context menus with subtle shadows
- Modal overlays with backdrop blur

**Forms & Inputs**:
- Rounded input fields with subtle borders
- Focus states with primary color outline
- Inline validation with appropriate color coding

### Interaction Patterns
- Hover states with subtle background color changes
- Click feedback with slight scale transforms
- Smooth transitions (150ms duration) for state changes
- Loading states with skeleton placeholders

### Key Features Layout
1. **Server Sidebar**: Vertical server icons with active state indicators
2. **Channel List**: Hierarchical channel organization with # and voice channel icons
3. **Main Chat**: Message history with infinite scroll, user avatars, and timestamps
4. **Member List**: Online/offline user status with role hierarchy
5. **Voice Controls**: Bottom action bar when in voice channels

### Visual Hierarchy
- Use Discord's familiar iconography patterns
- Maintain consistent 4px border radius across components
- Implement subtle shadows for depth (shadow-sm for most elements)
- Color-coded user roles and channel types

This design maintains Discord's proven UX patterns while ensuring the application feels familiar to users accustomed to modern chat interfaces.