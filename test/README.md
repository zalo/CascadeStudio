# CascadeStudio Tests

CascadeStudio uses end-to-end testing powered by playwright-test.

Upon each push:
 - Github Actions spins up a Windows Virtual machine
 - `python test/server.py` is started (in the background) from the main directory
 - `npx folio` is run from the `test` directory
 - This spins up a Chromium browser pointed at the python server
 - Playwright-test takes a picture of the page after it has loaded
 - Playwright-test compares that picture against one stored in `test/__snapshots__`
 - The test fails if these pictures are different

## Creating a new Canonical Snapshot

If you are putting a PR together and would like to generate a new base snapshot for testing:
 - Use Windows (apologies, I haven't thoroughly tested other operating systems)
 - Run `python test/server.py` from the main directory
 - Run `npx folio --update-snapshots --param browserName=chromium` from the test directory

After a few moments, you should see activity in the server window (suggesting it is serving content to the playwright instance), and eventually a new canonical screenshot will be inserted into the appropriate directory.  After committing, the tests should automatically use this picture for comparisons from then on.
