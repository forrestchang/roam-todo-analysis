# Todo Analysis Extension for Roam Research

Analyze your completed todos and gain insights into your productivity patterns.

## Features

- **Comprehensive Analytics**: Analyze all todos marked with `{{[[DONE]]}}`
- **Time-based Insights**:
  - Hourly distribution - See what time of day you're most productive
  - Weekday patterns - Understand your weekly rhythm
  - Monthly trends - Track seasonal variations
  - Last 30 days trend - Monitor recent productivity
- **Task Duration Analysis**:
  - Average completion time
  - Median completion time
- **Tag Analysis**: See your most frequently used tags
- **Visual Charts**: Clean, interactive bar charts for easy understanding

## How It Works

The extension searches for all blocks containing `{{[[DONE]]}}` and analyzes:
1. When tasks were completed (based on edit time)
2. How long tasks took (difference between creation and completion)
3. What tags were used
4. Productivity patterns over time

## Usage

1. Open the Command Palette (Cmd/Ctrl + P)
2. Type "Todo Analysis"
3. Press Enter
4. View your productivity analytics

## Requirements

- Your todos should be marked with `{{[[DONE]]}}` when completed
- The extension analyzes the edit timestamp to determine completion time

## Installation

This extension will be available through the Roam Depot marketplace. For local development:

1. Enable Developer Mode in Roam Research settings
2. Load this folder as a local extension
3. The command will be available in the Command Palette

## Tips for Better Analytics

1. **Consistent Marking**: Always mark completed todos with `{{[[DONE]]}}`
2. **Use Tags**: Tag your todos with `#work`, `#personal`, etc. for better insights
3. **Regular Updates**: Complete todos regularly to maintain accurate time tracking

## Privacy

All analysis is done locally in your browser. No data is sent to external servers.

## Development

This extension uses:
- Roam Alpha API for querying todo data
- Native JavaScript for data processing
- HTML/CSS for visualization (no external charting libraries)