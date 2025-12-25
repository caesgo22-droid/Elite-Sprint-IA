
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, adminProfile, loadingAuth } = useApp();

    if (loadingAuth) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Verifying access...</div>;
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (allowedRoles && (!adminProfile.role || !allowedRoles.includes(adminProfile.role))) {
        // Redirect if role doesn't match
        // Allow 'head coach' etc if role is just 'staff' generally, but here we check specific strings
        // Adjust logic based on strictness. For now, strict match or 'staff' encompasses all staff titles?
        // Let's assume adminProfile.role is the source of truth.
        // If the user is an athlete trying to access staff pages:
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
