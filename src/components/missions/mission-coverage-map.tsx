"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { Card, CardContent } from "@/components/ui/card";
import type { MissionCoveragePoint } from "@/types/domain";

function colorFromStatus(status: MissionCoveragePoint["status"]) {
  if (status === "approved") {
    return "#22c55e";
  }

  if (status === "flagged") {
    return "#f59e0b";
  }

  return "#b678f8";
}

function colorFromLayer(layer?: MissionCoveragePoint["layer"]) {
  if (layer === "geo_anomaly") {
    return "#ef4444";
  }

  if (layer === "revisit") {
    return "#f59e0b";
  }

  if (layer === "flagged") {
    return "#b678f8";
  }

  return "#22c55e";
}

export function MissionCoverageMap({ points }: { points: MissionCoveragePoint[] }) {
  if (!points.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Mission proof map points will appear after field workers sync completed assignments.
        </CardContent>
      </Card>
    );
  }

  const center = [points[0]!.latitude, points[0]!.longitude] as [number, number];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Mission proof map</h3>
            <p className="text-sm text-muted-foreground">
              Completed mission evidence plotted against the assigned verification area.
            </p>
          </div>
          <div className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium">
            {points.length} proof point(s)
          </div>
        </div>
        <div className="h-[480px] overflow-hidden rounded-[2rem]">
          <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((point) => (
              <CircleMarker
                key={point.id}
                center={[point.latitude, point.longitude]}
                radius={12}
                pathOptions={{
                  color: colorFromLayer(point.layer) ?? colorFromStatus(point.status),
                  fillColor: colorFromLayer(point.layer) ?? colorFromStatus(point.status),
                  fillOpacity: 0.72
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{point.projectName}</p>
                    <p>{point.enumeratorName}</p>
                    <p>{point.scope.district} / {point.scope.block}</p>
                    <p>{point.distanceMeters} m from target</p>
                    <p>Layer: {point.layer?.replaceAll("_", " ") ?? point.status}</p>
                    {point.riskLevel ? <p>Risk: {point.riskLevel}</p> : null}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
