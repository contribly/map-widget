# Contribly map widget

Reference implementation of a Javascript/Leftlet map showing geotagged contributions.
Makes use of the Contribly API geohash refinements end point to cluster contributions on the server.
Supports many (ie. thousands) of contributions.

Implemented using OpenStreetMap Leftlet, jQuery and Underscore.



## CSS structure

```
.contribly	
	.map
	    .marker
	        .marker-thumb   // Disable if using a background-image on .marker instead of the thumbnail image
	    .popup
	        h3
            img .thumb
	        .atttributes
	            .attribution
	            .created
	            .place
            .body	            	           
```
