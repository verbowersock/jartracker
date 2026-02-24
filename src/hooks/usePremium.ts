import { useContext } from "react";
import { SubscriptionContext } from "../contexts/SubscriptionContext";

export const usePremium = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("usePremium must be used within a SubscriptionProvider");
  }
  return context;
};
