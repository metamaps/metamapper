Run
```
./node_modules/.bin/emojipacks
```

If you get an error like
`/usr/bin/env: node --harmony: No such file or directory`
Go into the `./node_modules/.bin/emojipacks` file and remove the `--harmony` from the first line

when you get to the part where it asks for a path to the emojipack yaml file, provide
`./metacodes_emoji_pack/metacodes.yaml`