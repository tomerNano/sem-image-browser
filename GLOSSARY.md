# B2 GUI

A browser for the yeast SEM images stored in Backblaze B2, used by NanoScout biologists to find, preview and download them.

## Language

**Field**:
One named property of an image that the browser can show, sort or filter by, such as its size, upload time, pixel size or gold label. Its value comes from the B2 listing or the Registry, never from reading the image itself.
_Avoid_: column, attribute, meta field

**Tag**:
A short label the Registry gives a split (batch folder) in `split_tags.csv`, such as `10-3`, so splits with alike names can be told apart. A split may have several tags or none.
_Avoid_: label, category
