import { Shell } from "./components/layout/Shell";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "./pages/dashboard";
import Portfolios from "./pages/portfolios";
import PortfolioDetail from "./pages/portfolios/[id]";
import RiskAnalysis from "./pages/risk";
import Alerts from "./pages/alerts";
import Decisions from "./pages/decisions";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/portfolios" component={Portfolios} />
        <Route path="/portfolios/:id" component={PortfolioDetail} />
        <Route path="/risk" component={RiskAnalysis} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/decisions" component={Decisions} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
