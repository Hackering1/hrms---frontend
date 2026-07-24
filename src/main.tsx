import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import App from "./App";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import "./index.css";

// Lets AntD DatePickers parse typed dates like "25/05/2026" (DD/MM/YYYY),
// so every date field supports both typing and calendar selection.
dayjs.extend(customParseFormat);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: "10px", fontSize: "14px" },
            success: { iconTheme: { primary: "#6366f1", secondary: "#fff" } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
