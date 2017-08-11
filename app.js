var contriblyjQuery = $.noConflict();
var contriblyUnderscore = _.noConflict();
var contriblyLeaflet = L.noConflict();

function contriblyInitMap(span) {

    function publishContriblyEvent(ce) {
        if (typeof contriblyEventListener === "function") {
            ce['widget'] = 'map';
            contriblyEventListener(ce);
        }
    }

    var zoomGeohashes = {
        2: 1,
        3: 2,
        4: 3,
        5: 3,
        6: 3,
        7: 3,
        8: 4,
        9: 4,
        10: 4,
        11: 5,
        12: 5,
        13: 6,
        14: 6,
        15: 7,
        16: 7
    };
    var geohashBoundPrecisionForZooms = {
        2: 1,
        3: 1,
        4: 1,
        5: 1,
        6: 2,
        7: 2,
        8: 3,
        9: 3,
        10: 4,
        11: 4,
        12: 4,
        13: 5,
        14: 5,
        15: 6,
        16: 6
    };

    var topLevelGeohashes = ["b", "c", "f", "g", "u", "v", "y", "z", "8", "9", "d", "e", "s", "t", "w", "x", "2", "3", "6", "7", "k", "m", "q", "r", "0", "1", "4", "5", "h", "j", "n", "p"];

    var maxZoom = 10;
    var maxClusterSize = 20;

    var popupOptions = {autoPan: true, keepInView: true};

    var pendingLayers = [];

    function geoHashBoundingBoxRectangle(geohash, color) {
        var bounds = Geohash.bounds(geohash);
        var rectanglePoints = [[bounds.ne.lat, bounds.ne.lon], [bounds.sw.lat, bounds.sw.lon]];
        return contriblyLeaflet.rectangle(rectanglePoints, {color: color, weight: 0});
    }

    function addLayerToMap(key, layer) {
        if (contriblyUnderscore.contains(pendingLayers, key)) {
            layer.layerId = key;
            map.addLayer(layer);
        }
    }

    function latLongToPoint(latLong) {
        return [latLong.latitude, latLong.longitude];
    }

    function onScreenDistanceSquared(here, there) {
        var h = map.latLngToLayerPoint(latLongToPoint(here));
        var t = map.latLngToLayerPoint(latLongToPoint(there));
        var dx = h.x - t.x
        var dy = h.y - t.y
        return dx * dx + dy * dy
    }

    function attributesBarFor(attribution, created, place) {
          var attributesBar = contriblyjQuery('<ul>', {class: "attributes"});
          attributesBar.append(contriblyjQuery("<li>", {class: "attribution"}).text(attribution));
          var formattedCreatedDate = contriblyjQuery.format.date(created, "d MMMM yyyy")
          attributesBar.append(contriblyjQuery("<li>", {class: "created"}).text(formattedCreatedDate));
          if (place) {
            attributesBar.append(contriblyjQuery("<li>", {class: "place"}).text(place));
          }
          return attributesBar;
    }

    function popupForContribution(contribution) {
        var popup = contriblyjQuery("<div>", {class: "popup"});

        var heading = contriblyjQuery("<h3>").text(contribution.headline);
        var contributionHeadline = contribution.webUrl ? contriblyjQuery("<a>", {href: contribution.webUrl}).append(heading) : heading;
        popup.append(contributionHeadline);

        var mediaUsage = contribution.mediaUsages.length > 0 ? contribution.mediaUsages[0] : null;
        var mediumArtifact = mediaUsage != undefined ? contriblyUnderscore.find(mediaUsage.artifacts, function(artifact) {
            return artifact.label == "mediumoriginalaspectdouble" && artifact.url != undefined;
        }) : null;
        var thumbnail = mediumArtifact ? contriblyjQuery("<img>", {src: mediumArtifact.url, class: "thumb"}).attr("width", mediumArtifact.width).attr("height", mediumArtifact.height) : null;  // TODO Lazy load
        if (thumbnail) {
            popup.append(thumbnail);
        }
        var placeName = (contribution.place && contribution.place.name) ? contribution.place.name : "";
        popup.append(attributesBarFor(contribution.attribution, contribution.created, placeName));

        if (contribution.body) {
            popup.append(contriblyjQuery("<p>", {class: "body"}).text(contribution.body));
        }

        var holder = contriblyjQuery("<div>");
        holder.append(popup);
        return holder.html();
    }

    function markerForContribution(contribution) {
        var latLong = contribution.place.latLong;
        var mediaUsage = contribution.mediaUsages.length > 0 ? contribution.mediaUsages[0] : null;

        var smallArtifact = mediaUsage != undefined ? contriblyUnderscore.find(mediaUsage.artifacts, function(artifact) {
            return artifact.label == "small" && artifact.url != undefined;
        }) : null;

        var headline = contribution.webUrl ? '<a href="' + contribution.webUrl + '">' + contribution.headline + '</a>' : contribution.headline;
        var icon = smallArtifact ? '<img src="' + smallArtifact.url + '" width="40" />' : "";
        var body = (contribution.body != undefined) ? "<p>" + contribution.body + "</p>" : "";

        var point = latLongToPoint(latLong);

        var thumbnailIcon = new contriblyLeaflet.DivIcon({
            className: 'marker',
            html: '<span class="marker-thumb">' + icon + '</span>',
            iconSize: contriblyLeaflet.point(40, 40)
        });

        var marker = icon ?
           contriblyLeaflet.marker(point,
            {
                icon: thumbnailIcon
            }
        ) : contriblyLeaflet.marker(point);

        marker.originalPoint = point;

        marker.bindPopup(popupForContribution(contribution), popupOptions);
        return marker;
    }

    function clusterContributions(contributions) {
        var clusteredAlready = [];
        var clusters = [];

        contriblyjQuery.each(contributions, function(index, contribution) {

           var isClusteredAlready = contriblyUnderscore.contains(clusteredAlready, contribution)
           if (!isClusteredAlready) {
                var nearby = contriblyUnderscore.filter(contributions, function(c) {
                    if (contribution.id == c.id) {
                        return false;
                    }
                    if (contriblyUnderscore.contains(clusteredAlready, c)) {
                        return false;
                    }
                    return onScreenDistanceSquared(contribution.place.latLong, c.place.latLong) < 1500;
                });

                var cluster = [contribution].concat(nearby);
                clusteredAlready = clusteredAlready.concat(cluster);
                clusters.push(cluster);
           }

        });

        return clusters;
    }

    var overrideContriblyApi = span.attr('data-api');
    var contriblyApi = (overrideContriblyApi) ? overrideContriblyApi : "https://contriblyapi.global.ssl.fastly.net/1";
    var requestedAssignment = span.attr('data-assignment');

    function withRequestedAssignmentParameter() {
        return (requestedAssignment != undefined) ? "&assignment=" + requestedAssignment : "";
    }

    function draw() {

        function geoHashesToCoverMap(map) {
            if (zoom <= 2) {
                return topLevelGeohashes;
            }

            var precision = geohashBoundPrecisionForZooms[zoom];
            var mapCentre = map.getCenter();
            var mapCenterGeohash = Geohash.encode(mapCentre.lat, mapCentre.lng, precision);
            var neighbours = contriblyUnderscore.map(Geohash.neighbours(mapCenterGeohash), function(g){ return g; });
            return [mapCenterGeohash].concat(neighbours);
        }

        var zoom = map.getZoom();
        var geohashForZoom = zoomGeohashes[zoom];
        var geohashRefinement = "geohash" + (geohashForZoom);

        var geoHashesToCoverMap = geoHashesToCoverMap(map);

        var requiredLayerKeys = contriblyUnderscore.map(geoHashesToCoverMap, function(i){ return zoom + "-" + i; });

        var currentLayerKeys = [];
        map.eachLayer(function(l) {
            if (l.layerId != undefined) {
                currentLayerKeys.push(l.layerId);
            }
        })

        var layersToAdd = contriblyUnderscore.difference(requiredLayerKeys, currentLayerKeys);
        var layersToRemove = contriblyUnderscore.difference(currentLayerKeys, requiredLayerKeys);

        map.eachLayer(function(l) {
            if (l.layerId != undefined && contriblyUnderscore.contains(layersToRemove, l.layerId)) {
                map.removeLayer(l);
            }
        })

        pendingLayers = layersToAdd;

        var geohashesToLoad = contriblyUnderscore.map(layersToAdd, function(k){ return k.split("-")[1]; });
        contriblyjQuery.ajax({
            type: 'GET',
            url: contriblyApi + "/contribution-refinements?refinements=" + geohashRefinement + "&geohash=" + geohashesToLoad.join("%2C") + withRequestedAssignmentParameter(),
            success: function(refinements) {
                var geohashRefinements = refinements[geohashRefinement];

                contriblyjQuery.each(geohashesToLoad, function(f, g) {
                    var markers = [];

                    var cellContributions = 0;
                    contriblyjQuery.each(geohashRefinements, function(k, v) {
                        if (k.startsWith(g)) {
                            cellContributions = cellContributions + v;
                        }
                    });

                    var geohashesToDrawMarkersFor = [];

                    var showMarkers = zoom >= 6 && cellContributions <= maxClusterSize;
                    if (showMarkers) {
                        geohashesToDrawMarkersFor.push(g);

                    } else {
                        contriblyjQuery.each(geohashRefinements, function(k, v) {

                            if (k.startsWith(g)) {

                                if (v > 1) {

                                    function clusterClick(clusterLatLong, geohash) {
                                        var currentZoom = map.getZoom();

                                        if (currentZoom < maxZoom) {
                                            // Determine where to zoom to
                                            var zoomLevels = contriblyUnderscore.keys(zoomGeohashes);
                                            var higherZoomLevels = contriblyUnderscore.filter(zoomLevels, function(i) {
                                                return i > currentZoom;
                                            });

                                            var highGeohashes = contriblyUnderscore.uniq(contriblyUnderscore.map(higherZoomLevels, function(z) {
                                                return "geohash" + zoomGeohashes[z];
                                            }));

                                            var clusterZoomUrl = contriblyApi + "/contribution-refinements?geohash=" + geohash + "&refinements=" + highGeohashes.join("%2C") + withRequestedAssignmentParameter();

                                            contriblyjQuery.ajax({
                                                type: 'GET',
                                                url: clusterZoomUrl,
                                                success: function(refinements) {
                                                    var hashes = contriblyUnderscore.keys(refinements)

                                                    var th = null;
                                                    var lz = contriblyUnderscore.find(higherZoomLevels, function(z) {
                                                        var geohashForZoom = zoomGeohashes[z];
                                                        var geohash = "geohash" + geohashForZoom;
                                                        var refinement = refinements[geohash];
                                                        var refinementLength = contriblyUnderscore.size(refinement);
                                                        th = contriblyUnderscore.pairs(refinement)[0][0];   // Not strictly the correct centre but probably good enough
                                                        if (refinementLength > 1) {
                                                            return z;
                                                        }
                                                    });

                                                    var tz = lz ? parseInt(lz) : maxZoom;
                                                    var tll = th ? latLongCenterOfGeohash(th) : clusterLatLong;
                                                    map.flyTo(tll, tz);
                                                }
                                            });
                                        }
                                    }

                                    function latLongCenterOfGeohash(geohash) {
                                        var geohashEnclosingRectangle = geoHashBoundingBoxRectangle(geohash, 'blue'); // TODO really want a function for centre of geohash
                                        return geohashEnclosingRectangle.getBounds().getCenter();
                                    }

                                    var currentZoom = map.getZoom();
                                    if (currentZoom < maxZoom) {
                                        var cluster = new contriblyLeaflet.Marker(latLongCenterOfGeohash(k), {
                                            icon: new contriblyLeaflet.DivIcon({
                                                className: 'contribly-map-cluster',
                                                html: '<span class="contribly-map-cluster-count">' + v + '</span>',
                                                iconSize: contriblyLeaflet.point(53, 52)
                                            })
                                        });

                                        cluster.on("click", function (e) {
                                            clusterClick(this.getLatLng(), k);
                                        });

                                        markers.push(cluster);

                                    } else {
                                        geohashesToDrawMarkersFor.push(g);  // TODO this is probably too greedy; displaces other clusters loaded in the same query
                                    }

                                } else {
                                    geohashesToDrawMarkersFor.push(k);
                                }

                            }
                        });
                    }

                    if (geohashesToDrawMarkersFor.length > 0) {
                        contriblyjQuery.ajax({
                            type: 'GET',
                            url: contriblyApi + "/contributions?geohash=" + geohashesToDrawMarkersFor.join("%2C") + withRequestedAssignmentParameter(),
                            success: function(contributions, textStatus, jqXHR) {
                                var clusters = clusterContributions(contributions);
                                contriblyjQuery.each(clusters, function(index, cluster) {

                                    if (cluster.length > 1) {
                                        var clusterCenter = cluster[0].place.latLong;   // TODO not the best approximation
                                        var clusterCenterPoint = map.latLngToLayerPoint(latLongToPoint(clusterCenter));

                                        var spiderTheta = (2 * Math.PI) / cluster.length;
                                        var spiderRadius = 50 / (2 * Math.sin(spiderTheta / 2));

                                        var clusterMarkers = [];
                                        contriblyjQuery.each(cluster, function(index, c) {
                                            var marker = markerForContribution(c)
                                            marker.off('click');
                                            marker.spidered = false;
                                            marker.belongsToCluster = cluster;
                                            clusterMarkers.push(marker);
                                        });

                                        var clusterLayer = contriblyLeaflet.featureGroup(clusterMarkers);
                                        clusterLayer.on('click', function(e) {
                                            if (e.layer.spidered && e.layer._popup) {
                                                e.layer.openPopup();
                                            }

                                            var markersToSpider = [];
                                            this.eachLayer(function(ml) {
                                                markersToSpider.push(ml);
                                            });

                                            var s = 0;
                                            this.eachLayer(function(ml) {
                                                if (ml.circle) {
                                                    ml.setRadius(ml.expandedRadius);
                                                } else {
                                                    var spideredPoint = contriblyLeaflet.point([clusterCenterPoint.x + (Math.sin(spiderTheta * s) * spiderRadius), clusterCenterPoint.y +  (Math.cos(spiderTheta * s) * spiderRadius)]);
                                                    var expandedLatLong = map.layerPointToLatLng(spideredPoint)
                                                    ml.setLatLng(expandedLatLong);
                                                    ml.spidered = true;
                                                    s = s + 1;
                                                }
                                             });
                                        })

                                        cluster.clusterLayer = clusterLayer;
                                        markers.push(clusterLayer);

                                    } else {
                                        contriblyjQuery.each(cluster, function(index, c) {
                                            markers.push(markerForContribution(c));
                                        });
                                    }
                                });

                                layer = contriblyLeaflet.layerGroup(markers);
                                addLayerToMap(zoom + "-" + g, layer);

                            },
                            error: function(data) {
                            }
                        });

                    } else {
                        layer = contriblyLeaflet.layerGroup(markers);
                        addLayerToMap(zoom + "-" + g, layer);
                    }

                });

            },
            error: function(data) {
            }
        });
    }

    mapDiv = contriblyjQuery("<div>", {class: "map"});

    var wrapper = contriblyjQuery("<div>", {class: "contribly"});
    wrapper.append(mapDiv);
    span.append(wrapper);

    var map = contriblyLeaflet.map(mapDiv.get(0), {
        center: [53, 2],
        zoom: 4,
        minZoom: 2,
        maxZoom: maxZoom,
        worldCopyJump: true
    });

    // Example only; use commerical tiles for in production
    var tileLayer = "http://tiles1-f421b54070a26db3da72542a5b4d9fd2.skobblermaps.com/TileService/tiles/2.0/000011301/0/{z}/{x}/{y}.png"
    var tileAttribution = '<a href="http://developer.skobbler.com/" target="_blank">Scout</a>, <a href="http://www.openstreetmap.org" target="_blank">OpenStreetMap</a>';

    contriblyLeaflet.tileLayer(tileLayer, {
        attribution: tileAttribution
    }).addTo(map);


    map.on('popupopen', function(e) {
        this._locked = true;
    });

    function deSpider(clusterLayer) {
        clusterLayer.eachLayer(function(ml) {
            if (ml.circle) {
                // ml.setRadius(0);
            } else {
                ml.setLatLng(ml.originalPoint);
                ml.spidered = false;
            }
        });
    }

   map.on('popupclose', function(e){
       if (e.popup._source.belongsToCluster) {
        deSpider(e.popup._source.belongsToCluster.clusterLayer);
       }
      this._locked = false;
   });

    map.on('moveend', function(e) {
        if (!this._locked) {
            draw();
        }
    });

    function setMapToInitialBounds() {

        function calculateBoundsForEnclosingGeohashes(enclosingGeohashes) {
            var geohashBounds = contriblyUnderscore.map(Object.keys(enclosingGeohashes), function(gh) {
                return Geohash.bounds(gh);
            });

            var northMostLatitude = contriblyUnderscore.max(contriblyUnderscore.map(geohashBounds, function(b) {
                return b.ne.lat
            }));

            var southMostLatitude = contriblyUnderscore.min(contriblyUnderscore.map(geohashBounds, function(b) {
                return b.sw.lat
            }));

           var westMostLongitude = contriblyUnderscore.max(contriblyUnderscore.map(geohashBounds, function(b) {
                return b.sw.lon
            }));

            var eastMostLongitude = contriblyUnderscore.min(contriblyUnderscore.map(geohashBounds, function(b) {
                return b.ne.lon;
            }));

            return contriblyLeaflet.latLngBounds(
                contriblyLeaflet.latLng(southMostLatitude, westMostLongitude),
                contriblyLeaflet.latLng(northMostLatitude, eastMostLongitude)
            )
        }

        contriblyjQuery.ajax({
            url: contriblyApi + "/contribution-refinements?refinements=geohash3" + withRequestedAssignmentParameter(),
            success:function(data) {
                var enclosingGeohashes = data.geohash3;
                var bounds = calculateBoundsForEnclosingGeohashes(enclosingGeohashes);
                // map.fitBounds(bounds);
                draw();
            }
        });
    }

    setMapToInitialBounds();

    publishContriblyEvent({type: "loaded"})
}

contriblyjQuery('.contribly-map').each(function(i, v) {
    var requestedCss = contriblyjQuery.attr('data-css');
    var cssToLoad = (requestedCss != undefined) ? requestedCss : "https://s3-eu-west-1.amazonaws.com/contribly-widgets/map/map2017030904.css";
    contriblyjQuery.ajax({
        url: cssToLoad,
        success: function(data) {
            contriblyjQuery("head").append("<style>" + data + "</style>");
            contriblyInitMap(contriblyjQuery(v));
        }
    });
});
