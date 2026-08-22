import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Workspace from "./pages/Workspace";
import AccountsManagement from "./pages/AccountsManagement";
import OfficialDocumentPage from "./pages/OfficialDocumentPage";
import LocalLogin from "./pages/LocalLogin";
import ChangePassword from "./pages/ChangePassword";
import CustomerPortalPage from "@/pages/CustomerPortalPage";
import About from "@/pages/About";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import PasswordReset from "@/pages/PasswordReset";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/about"} component={About} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/login"} component={LocalLogin} />
      <Route path={"/forgot-password"} component={PasswordReset} />
      <Route path={"/reset-password"} component={PasswordReset} />
      <Route path={"/change-password"} component={ChangePassword} />
      <Route path={"/app"}>{() => <Workspace module="dashboard" />}</Route>
      <Route path={"/accountant"}>{() => <Workspace module="accountant" />}</Route>
      <Route path={"/sales"}>{() => <Workspace module="sales" />}</Route>
      <Route path={"/billing"}>{() => <Workspace module="billing" />}</Route>
      <Route path={"/print/:type/:id"} component={OfficialDocumentPage} />
      <Route path={"/customer-portal/:token"} component={CustomerPortalPage} />
      <Route path={"/accounting"}>{() => <Workspace module="accounting" />}</Route>
      <Route path={"/accounts"} component={AccountsManagement} />
      <Route path={"/operations"}>{() => <Workspace module="operations" />}</Route>
      <Route path={"/tax"}>{() => <Workspace module="tax" />}</Route>
      <Route path={"/documents"}>{() => <Workspace module="documents" />}</Route>
      <Route path={"/audit"}>{() => <Workspace module="audit" />}</Route>
      <Route path={"/settings"}>{() => <Workspace module="settings" />}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
