var contriblyjQuery = $.noConflict();
var contriblyUnderscore = _.noConflict();
var contriblyLeaflet = L.noConflict();

function contriblyInitMap(span) {

    var zoomGeohashes = {
        2: 1,
        3: 2,
        4: 2,
        5: 2,
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

    var maxZoom = 16;

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

    function markerForContribution(contribution) {
        var latLong = contribution.place.latLong;
        var mediaUsage = contribution.mediaUsages.length > 0 ? contribution.mediaUsages[0] : null;

        var smallArtifact = mediaUsage != undefined ? contriblyUnderscore.find(mediaUsage.artifacts, function(artifact) {
            return artifact.label == "small" && artifact.url != undefined;
        }) : null;

         var mediumArtifact = mediaUsage != undefined ? contriblyUnderscore.find(mediaUsage.artifacts, function(artifact) {
            return artifact.label == "medium" && artifact.url != undefined;
        }) : null;

        var headline = contribution.webUrl ? '<a href="' + contribution.webUrl + '">' + contribution.headline + '</a>' : contribution.headline;
        var icon = smallArtifact ? '<img src="' + smallArtifact.url + '" width="40" />' : "";
        var thumbnail = mediumArtifact ? '<p><img src="' + mediumArtifact.url + '" width="240" /></p>' : "";
        var body = (contribution.body != undefined) ? "<p>" + contribution.body + "</p>" : "";

        var point = latLongToPoint(latLong);

        var marker = icon ?
           contriblyLeaflet.marker(point,
            {
                zIndexOffset: 10,
                icon: new contriblyLeaflet.DivIcon({
                    className: 'my-div-icon',
                    html: '<span class="my-div-span">' + icon + '</span>',
                    iconSize: contriblyLeaflet.point(40, 40)
                })

            }
        ) : contriblyLeaflet.marker(point);

        marker.bindPopup("<b>" + headline + "</b>" + thumbnail);

        marker.originalPoint = latLongToPoint(latLong);

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
    var contriblyApi = (overrideContriblyApi) ? overrideContriblyApi : "https://api.contribly.com/1";
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

                    if (zoom >= 6 && cellContributions <= 20) {
                        geohashesToDrawMarkersFor.push(g);

                    } else {
                        contriblyjQuery.each(geohashRefinements, function(k, v) {

                            if (k.startsWith(g)) {

                                if (v > 1) {

                                    function clusterClick(latLong) {
                                        var currentZoom = map.getZoom();
                                        if (currentZoom < maxZoom) {
                                          map.flyTo(latLong, map.getZoom() + 1);

                                        } else {
                                            // TODO UI for unbroken clusters?
                                        }
                                    }

                                    var geohashEnclosingRectangle = geoHashBoundingBoxRectangle(k, 'blue'); // TODO really want a function for centre of geohash
                                    var label = new contriblyLeaflet.Marker(geohashEnclosingRectangle.getBounds().getCenter(), {
                                        zIndexOffset: 1001,
                                        icon: new contriblyLeaflet.DivIcon({
                                            className: 'my-div-icon',
                                            html: '<div class="contribly-map-cluster"><span class="contribly-map-cluster-count">' + v + '</span></div>',
                                            iconSize: contriblyLeaflet.point(53, 52)
                                        })
                                    });

                                    label.on("click", function (e) {
                                        clusterClick(this.getLatLng());
                                    });

                                    markers.push(label);

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
                                        var clusterCenter = cluster[0].place.latLong;
                                        var label = new contriblyLeaflet.Marker(latLongToPoint(clusterCenter), {
                                            zIndexOffset: 1000,
                                            icon: new contriblyLeaflet.DivIcon({
                                                className: 'my-div-icon',
                                                html: '<div class="contribly-map-cluster-yellow"><span class="contribly-map-cluster-count">' + cluster.length + '</span></div>',
                                                iconSize: contriblyLeaflet.point(53, 52)
                                            })
                                        });

                                        var clusterMarkers = [];
                                        contriblyjQuery.each(cluster, function(index, c) {
                                            var marker = markerForContribution(c)
                                            clusterMarkers.push(marker);
                                        });

                                        var clusterLayer = contriblyLeaflet.featureGroup(clusterMarkers);

                                        var gap = 20;
                                        clusterLayer.on('mouseover', function() {
                                            var s = gap;

                                            var markersToSpider = [];
                                            this.eachLayer(function(ml) {
                                                markersToSpider.push(ml);
                                            });

                                            var spiderRadius = 20 * (markersToSpider.length / 3);
                                            var spiderTheta = (2 * Math.PI) / markersToSpider.length;

                                            var clusterCenterPoint = map.latLngToLayerPoint(latLongToPoint(clusterCenter));

                                            var s = 0;
                                            this.eachLayer(function(ml) {
                                                var spideredPoint = contriblyLeaflet.point([clusterCenterPoint.x + (Math.sin(spiderTheta * s) * spiderRadius), clusterCenterPoint.y +  (Math.cos(spiderTheta * s) * spiderRadius)]);
                                                var expandedLatLong = map.layerPointToLatLng(spideredPoint)
                                                ml.setLatLng(expandedLatLong);
                                                s = s + 1;
                                             });
                                         })

                                        clusterLayer.on('mouseout', function() {
                                            var s = gap;
                                            this.eachLayer(function(ml) {
                                                 ml.setLatLng(ml.originalPoint);
                                                 s = s * -1;
                                              });
                                          })

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

    mapDiv = contriblyjQuery('<div class="contribly-map-panel"></div>');
    span.append(mapDiv);

    var map = contriblyLeaflet.map(mapDiv.get(0), {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: maxZoom,
        worldCopyJump: true
    });

    // Example only; use commerical tiles for in production
    var tileLayer='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var tileAttribution='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';

    contriblyLeaflet.tileLayer(tileLayer, {
        attribution: tileAttribution
    }).addTo(map);

    map.on('moveend', function(e) {
        draw();
    });

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

    function setMapToInitialBounds() {
        contriblyjQuery.ajax({
            url: contriblyApi + "/contribution-refinements?refinements=geohash3" + withRequestedAssignmentParameter(),
            success:function(data) {
                var enclosingGeohashes = data.geohash3;
                var bounds = calculateBoundsForEnclosingGeohashes(enclosingGeohashes);
                map.fitBounds(bounds);
                draw();
            }
        });
    }

    setMapToInitialBounds();
}

contriblyjQuery.ajax({
    url: "https://s3-eu-west-1.amazonaws.com/contribly-widgets/map/map2017012201.css",
    success:function(data) {
        contriblyjQuery("head").append("<style>" + data + "</style>");
        contriblyjQuery('.contribly-map').each(function(i, v) {
            contriblyInitMap(contriblyjQuery(v));
        });
    }
});