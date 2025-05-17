import type { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '../src/theme';

// Styles externes
import 'bootstrap/dist/css/bootstrap.min.css';

// Styles globaux de l'application
import '../src/styles/base/variables.css';
import '../src/styles/base/globals.css';

// Ancien import conservé en commentaire pour référence
// import '../src/css/DVFProperties.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  );
} 