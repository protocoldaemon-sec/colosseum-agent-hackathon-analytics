import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ShinyText from './ui/ShinyText';

function Footer() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  
  const logoSrc = theme === 'dark' 
    ? '/logo_white_transparent.png' 
    : '/logo_black_transparent.png';
    
  const colosseumLogoSrc = theme === 'dark'
    ? '/Logo-Design-Full-Color-White.png'
    : '/Logo-Design-Full-Color-Black.png';

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Disclaimer */}
        <motion.div 
          className="footer-disclaimer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="disclaimer-header">
            <span className="material-symbols-outlined size-20">info</span>
            <span className="disclaimer-badge">{t('footer.note')}</span>
          </div>
          <p>{t('footer.disclaimer')}</p>
        </motion.div>

        {/* Main Footer */}
        <div className="footer-main">
          {/* Left: Logo & Info */}
          <motion.div 
            className="footer-section"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="footer-label">{t('footer.builtBy')}</p>
            <div className="footer-brand">
              <img src={logoSrc} alt="ARS Logo" className="footer-logo" />
              <div>
                <h3 className="footer-brand-name">ARS Analytics</h3>
                <p className="footer-description">
                  The future is agent-native
                </p>
              </div>
            </div>
            
            <div className="footer-links">
              <h4 className="footer-links-title">Connect</h4>
              <div className="footer-social">
                <a 
                  href="https://colosseum.com/agent-hackathon/projects/agentic-reserve-system"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link social-link-primary"
                  aria-label="ARS Agent"
                >
                  <span className="material-symbols-outlined size-20">smart_toy</span>
                  <span>ars-agent</span>
                </a>
                <a 
                  href="https://x.com/Agenticreserve" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="Twitter"
                >
                  <span className="material-symbols-outlined size-20">alternate_email</span>
                  <span>Twitter</span>
                </a>
                <a 
                  href="https://github.com/protocoldaemon-sec/colosseum-agent-hackathon-analytics" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="GitHub"
                >
                  <span className="material-symbols-outlined size-20">code</span>
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </motion.div>

          {/* Center: Tagline */}
          <motion.div 
            className="footer-section footer-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="footer-highlight">
              <p className="footer-tagline-large">Building the future of agent analytics</p>
              <p className="footer-subtitle">Agentic Reserve System</p>
            </div>
          </motion.div>

          {/* Right: Powered By */}
          <motion.div 
            className="footer-section footer-right"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="footer-powered">
              <p className="footer-label">{t('footer.poweredBy')}</p>
              <a 
                href="https://colosseum.com/agent-hackathon/"
                target="_blank"
                rel="noopener noreferrer"
                className="colosseum-link"
              >
                <img 
                  src={colosseumLogoSrc} 
                  alt="Colosseum" 
                  className="colosseum-logo"
                />
              </a>
              <p className="footer-subtitle">{t('footer.hackathon')}</p>
            </div>
          </motion.div>
        </div>

        {/* Bottom */}
        <motion.div 
          className="footer-bottom"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="footer-bottom-content">
            <p>© {currentYear} ARS Agent. Open Source Project.</p>
            <div className="footer-bottom-links">
              <a 
                href="https://github.com/protocoldaemon-sec/colosseum-agent-hackathon-analytics/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT License
              </a>
              <span className="separator">•</span>
              <a 
                href="https://colosseum.com/agent-hackathon"
                target="_blank"
                rel="noopener noreferrer"
              >
                Colosseum Hackathon
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

export default Footer;
