# Hans Financial Note

A comprehensive personal finance management application with dual-currency support (THB/IDR), budget tracking, investment projections, and utility monitoring.

## Features

### Core Features
- **Dual Currency Support**: Track finances in Thai Baht (THB) and Indonesian Rupiah (IDR)
- **Real-time Exchange Rates**: Automatic fetching from multiple API sources
- **Transaction Management**: Add, edit, delete transactions with categories
- **Balance Tracking**: Monitor current balances in both currencies

### Budget Management
- Annual income and monthly budget settings
- Real-time spending tracking with visual progress
- Daily budget calculations
- Spending alerts when approaching limits

### Investment Tracking
- Portfolio allocation settings (stocks/crypto split)
- Expected return projections
- FIRE (Financial Independence) calculator
- Long-term wealth projection charts

### Utility Monitoring
- Electricity consumption tracking with threshold-based billing
- Water usage monitoring
- Automatic expense creation for utility bills
- Historical usage charts

### Cloud Integration
- **Firebase Authentication**: Google sign-in for cloud sync
- **Firestore**: Real-time data synchronization across devices
- **Google Sheets**: Export data to spreadsheets
- **Google Drive**: Receipt image storage

### Progressive Web App
- Offline capability with service worker
- Installable on mobile devices
- Background sync for transactions
- Push notifications support

## Project Structure

```
FinanceNote/
├── index.html          # Main application HTML
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── css/
│   └── styles.css     # Complete stylesheet
├── js/
│   ├── config.js      # Configuration constants
│   ├── storage.js     # LocalStorage utilities
│   ├── firebase-service.js  # Firebase integration
│   ├── google-api.js  # Google Sheets/Drive API
│   ├── exchange-rate.js     # Currency conversion
│   ├── utilities.js   # Electricity/water tracking
│   ├── transactions.js      # Transaction management
│   ├── budget.js      # Budget calculations
│   ├── investments.js # Investment projections
│   ├── charts.js      # Chart.js visualizations
│   ├── modals.js      # Modal dialogs
│   └── app.js         # Main application logic
├── images/            # App icons and images
└── docs/              # Documentation
```

## Setup

### Prerequisites
- Modern web browser with JavaScript enabled
- (Optional) Firebase project for cloud sync
- (Optional) Google Cloud project for Sheets/Drive integration

### Configuration

1. **Firebase Setup** (for cloud sync):
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Google provider)
   - Enable Firestore Database
   - Copy your config to `js/config.js`

2. **Google API Setup** (for Sheets/Drive):
   - Create a project at [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google Sheets API and Google Drive API
   - Create OAuth 2.0 credentials
   - Update `js/config.js` with your credentials

### Running Locally

Simply open `index.html` in a browser, or serve with a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

## Usage

### First-Time Setup
1. Complete the setup wizard with your initial balances
2. Set your annual income and monthly budget
3. Configure investment allocation preferences

### Adding Transactions
1. Select transaction type (Income/Expense/Transfer)
2. Choose category
3. Enter amount and currency
4. Add optional description
5. Submit

### Managing Budget
- View monthly spending progress
- Check daily budget allowance
- Monitor spending by category

### Investment Planning
- Set allocation percentage from income
- Configure stock/crypto split
- View long-term projections
- Calculate FIRE timeline

### Utility Tracking
- Enter meter readings (previous and current)
- System calculates usage and cost
- Automatic expense transactions created

## Technologies Used

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Charts**: Chart.js
- **Date/Time**: Luxon
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Storage**: LocalStorage, IndexedDB
- **APIs**: Google Sheets API, Google Drive API

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

MIT License - Feel free to use and modify for personal or commercial projects.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Author

Hans Financial Note - Personal Finance Management
