import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handleBookRide = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "booking" } });
    } else {
      navigate(user?.role === "admin" ? "/admin" : user?.role === "driver" ? "/driver-dashboard" : "/student-dashboard");
    }
  };

  return { handleBookRide };
};
