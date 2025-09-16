# Care Manager Platform

## Overview

This is a Korean care manager platform called "시니어랑" (CareLink) that connects families with professional caregivers. The platform provides services such as hospital accompaniment, grocery shopping, housework assistance, and companionship for elderly care.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
- **Frontend**: React with TypeScript using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query for server state, React Context for auth state
- **Routing**: Wouter for client-side routing

### Directory Structure
```
client/          # React frontend application
server/          # Express.js backend server
shared/          # Shared schemas and types
attached_assets/ # Static assets and component templates
```

## Key Components

### Frontend Architecture
- **React Application**: Built with Vite, using TypeScript
- **Component Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: 
  - React Query for API data fetching and caching
  - React Context for authentication state
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Express.js Server**: RESTful API with middleware for logging and error handling
- **Storage Layer**: In-memory storage implementation with interface for future database integration
- **API Routes**: Authentication, care managers, services, bookings, and messaging

### Database Schema
- **Users**: Authentication and profile information
- **Care Managers**: Professional caregiver profiles with ratings and services
- **Services**: Available care services (hospital accompaniment, shopping, etc.)
- **Bookings**: Service reservations and scheduling
- **Messages**: Chat functionality between users and care managers

## Data Flow

### Authentication Flow
1. User registration/login through email or social providers
2. JWT-like session management (currently mock implementation)
3. Protected routes require authentication

### Service Discovery Flow
1. Users browse available services
2. Filter care managers by service type, location, and ratings
3. View detailed profiles and reviews

### Booking Flow
1. Users select care manager and service
2. Schedule appointment with date/time
3. Real-time status updates and communication

### Communication Flow
1. Chat interface between users and care managers
2. Real-time messaging (currently mock data)
3. Booking-related notifications

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React, React DOM, React Query
- **UI Components**: Radix UI primitives, shadcn/ui components
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **Forms**: React Hook Form with Zod validation
- **Routing**: Wouter
- **Date Handling**: date-fns

### Backend Dependencies
- **Server**: Express.js with TypeScript
- **Database**: Drizzle ORM with PostgreSQL support
- **Validation**: Zod schemas
- **Development**: tsx for TypeScript execution, Vite for frontend building

### Database Integration
- **Drizzle ORM**: Type-safe database queries with full relation mapping
- **PostgreSQL**: Primary database (fully integrated and operational)
- **Neon Database**: Serverless PostgreSQL provider (@neondatabase/serverless)
- **Database Schema**: Complete with users, care_managers, services, bookings, messages tables
- **Seeding**: Initial data populated with 4 services and 5 care managers

## Deployment Strategy

### Development
- Frontend: Vite dev server with HMR
- Backend: tsx for TypeScript execution with nodemon-like behavior
- Database: In-memory storage for development

### Production Build
- Frontend: Vite build to static assets
- Backend: esbuild bundle for Node.js
- Database: PostgreSQL connection via environment variables

### Environment Configuration
- Database URL through environment variables
- Drizzle migrations for schema management
- Static file serving for production frontend

## Key Features

### Service Categories
- Hospital accompaniment (병원 동행)
- Grocery shopping (장보기)
- Housework assistance (가사 도움)
- Companionship (말벗)

### Care Manager Features
- Professional profiles with ratings and reviews
- Service specializations and availability
- Location-based matching
- Certified caregiver badges

### User Experience
- Mobile-first responsive design
- Bottom navigation for mobile devices
- Real-time chat interface
- Booking management and history
- Social authentication options

### Authentication Methods
- Email/password registration
- Google OAuth integration
- Kakao OAuth integration (Korean social login)

## Technical Considerations

### Performance
- React Query for efficient data fetching and caching
- Optimistic updates for better UX
- Image optimization and lazy loading

### Accessibility
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility

### Internationalization
- Korean language primary support
- Date and number formatting for Korean locale
- Cultural considerations for elderly care services

### Security
- Input validation with Zod schemas
- CORS configuration
- Session management
- Protected API endpoints