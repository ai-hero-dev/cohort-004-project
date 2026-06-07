# Configure ccstatusline

## Create the config directory

```bash
mkdir -p ~/.config/ccstatusline
```

## Create ~/.config/ccstatusline/settings.json with this content:

```json
{
  "version": 3,
  "lines": [
    [
      {
        "id": "1",
        "type": "context-length",
        "color": "yellow",
        "bold": true,
        "rawValue": true
      },
      {
        "id": "2",
        "type": "custom-text",
        "customText": "(",
        "color": "brightBlack",
        "merge": "no-padding"
      },
      {
        "id": "3",
        "type": "context-percentage",
        "color": "brightBlack",
        "rawValue": true,
        "merge": "no-padding"
      },
      {
        "id": "4",
        "type": "custom-text",
        "customText": ")",
        "color": "brightBlack",
        "merge": "no-padding"
      }
    ],
    [],
    []
  ],
  "flexMode": "full-minus-40",
  "compactThreshold": 60,
  "colorLevel": 2,
  "defaultSeparator": " ",
  "inheritSeparatorColors": false,
  "globalBold": false,
  "powerline": {
    "enabled": false,
    "separators": [" "],
    "separatorInvertBackground": [false],
    "startCaps": [],
    "endCaps": [],
    "autoAlign": false
  }
}
```

# Update Claude Code Settings

##  Open ~/.claude/settings.json

If this file doesn't exist yet, create it.

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx ccstatusline@latest"
  }
}
```