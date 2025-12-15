// @ts-nocheck
/* eslint-disable */
import React from "react";
import logoUrl from "../../assets/dbsaicle_logo.svg";

interface DbSaicleLogoProps {
  height?: number;
  width?: number;
}

export default function DbSaicleLogo({ height = 200, width = 200 }: DbSaicleLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="DbSaicle logo"
      height={height}
      width={width}
      style={{ display: "block" }}
    />
  );
}
