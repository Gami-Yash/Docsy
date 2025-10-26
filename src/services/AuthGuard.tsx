import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/appwrite/auth";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            const currentUser = await getCurrentUser();
            if (currentUser) {
                navigate("/dashboard");
            }
        };

        checkSession();
    }, [navigate]);

    return <>{children}</>;
};

export default AuthGuard;