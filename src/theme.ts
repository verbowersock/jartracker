// App Theme Configuration
export const theme = {
  colors: {
    primary: "#5d7a5d", // Main green color for buttons and outlines
    primaryDark: "#4a6249", // Darker shade for pressed states
    primaryLight: "#7a9679", // Lighter shade for subtle elements
    background: "#fefcf8", // Main background color
    surface: "#ffffff", // Card/surface background
    surfaceSecondary: "#f8f6f2", // Secondary surface color
    text: "#333333", // Primary text color
    textSecondary: "#666666", // Secondary text color
    textLight: "#999999", // Light text color
    success: "#2e7d32", // Success/available state
    error: "#d32f2f", // Error/used state
    warning: "#f57c00", // Warning state
    border: "#e0e0e0", // Default border color
    borderLight: "#f0f0f0", // Light border color
    shadow: "#000000", // Shadow color
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    round: 20,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  fontWeight: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  shadow: {
    small: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  },
  categoryColors: {
    fruits: "#FFE0B2",
    vegetables: "#C8E6C9",
    preserves: "#FFF3E0",
    pickles: "#E8F5E8",
    sauces: "#FFCDD2",
    meats: "#F3E5F5",
    other: "#E0E0E0",
  },
  typography: {
    headingTitle: {
      fontSize: 24, // xxl size
      fontWeight: "700" as const, // bold
      color: "#333333", // text color
    },
    headerContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
  },
};

export type Theme = typeof theme;
