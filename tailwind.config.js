module.exports = {
  content: [
    './*.html',
    './pages/**/*.html',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        'ff-bg': '#0F172A',
        'ff-elevated': '#111C33',
        'ff-card': '#17223A',
        'ff-paper': '#FFFDF8',
        'ff-amber': '#F59E0B',
        'ff-teal': '#14B8A6',
        'ff-income': '#22C55E',
        'ff-expense': '#EF4444'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        ledger: '0 24px 60px rgba(2, 6, 23, 0.18)'
      }
    }
  },
  plugins: []
};
