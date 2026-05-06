#!/usr/bin/env python3
"""Attempt to launch an Oracle Cloud Infrastructure ARM Ampere A1 instance.

Designed to be invoked from a GitHub Actions cron workflow that retries every
few minutes until the requested capacity is available. Honours these env vars:

  OCI_USER_OCID              ocid1.user.oc1...
  OCI_FINGERPRINT            01:23:45:...:ef
  OCI_TENANCY_OCID           ocid1.tenancy.oc1...
  OCI_REGION                 e.g. ap-singapore-2
  OCI_PRIVATE_KEY            full PEM contents (BEGIN/END lines)
  OCI_COMPARTMENT_OCID       compartment to launch the instance in
  OCI_AVAILABILITY_DOMAIN    e.g. dKwl:AP-SINGAPORE-2-AD-1
  OCI_SUBNET_OCID            public subnet OCID
  OCI_IMAGE_OCID             Ubuntu 24.04 ARM image OCID for the region
  OCI_SSH_PUBLIC_KEY         single-line ssh-ed25519 / ssh-rsa public key
  OCI_DISPLAY_NAME           optional, defaults to cloudos-prod
  OCI_OCPUS                  optional int, defaults to 4
  OCI_MEMORY_GB              optional int, defaults to 24
  OCI_BOOT_VOLUME_GB         optional int, defaults to 50

Exits 0 with `success=true` when an instance is launched; exits 0 with
`success=false reason=out_of_capacity` on the expected capacity error so the
GitHub Actions cron does not mark the run as failed; exits 1 on any other
error so the failure is surfaced.

The script writes structured outputs to ``$GITHUB_OUTPUT`` when running in
GitHub Actions:

  success=<true|false>
  reason=<out_of_capacity|other>
  instance_id=<ocid> (only when success=true)
  display_name=<name> (only when success=true)
"""

from __future__ import annotations

import os
import sys
from typing import Any

import oci
from oci.core.models import (
    CreateVnicDetails,
    InstanceSourceViaImageDetails,
    LaunchInstanceDetails,
    LaunchInstanceShapeConfigDetails,
)
from oci.exceptions import ServiceError


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.stderr.write(f"missing required env var: {name}\n")
        sys.exit(1)
    return value


def _optional_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        sys.stderr.write(f"env var {name}={raw!r} is not an integer\n")
        sys.exit(1)


def _set_output(**kwargs: Any) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    with open(out, "a", encoding="utf-8") as fp:
        for key, value in kwargs.items():
            fp.write(f"{key}={value}\n")


def _is_out_of_capacity(err: ServiceError) -> bool:
    code = (err.code or "").lower()
    message = (err.message or "").lower()
    return (
        code in {"outofhostcapacity", "internalerror"}
        and ("out of host capacity" in message or "host capacity" in message)
    ) or "out of host capacity" in message or "out of capacity" in message


def main() -> int:
    config = {
        "user": _require("OCI_USER_OCID"),
        "fingerprint": _require("OCI_FINGERPRINT"),
        "tenancy": _require("OCI_TENANCY_OCID"),
        "region": _require("OCI_REGION"),
        "key_content": _require("OCI_PRIVATE_KEY"),
    }
    oci.config.validate_config(config)

    compartment = _require("OCI_COMPARTMENT_OCID")
    availability_domain = _require("OCI_AVAILABILITY_DOMAIN")
    subnet = _require("OCI_SUBNET_OCID")
    image = _require("OCI_IMAGE_OCID")
    ssh_public_key = _require("OCI_SSH_PUBLIC_KEY")

    ocpus = _optional_int("OCI_OCPUS", 4)
    memory_gb = _optional_int("OCI_MEMORY_GB", 24)
    boot_volume_gb = _optional_int("OCI_BOOT_VOLUME_GB", 50)
    display_name = os.environ.get("OCI_DISPLAY_NAME", "").strip() or "cloudos-prod"

    compute = oci.core.ComputeClient(config)

    details = LaunchInstanceDetails(
        availability_domain=availability_domain,
        compartment_id=compartment,
        display_name=display_name,
        shape="VM.Standard.A1.Flex",
        shape_config=LaunchInstanceShapeConfigDetails(
            ocpus=float(ocpus),
            memory_in_gbs=float(memory_gb),
        ),
        create_vnic_details=CreateVnicDetails(
            subnet_id=subnet,
            assign_public_ip=True,
        ),
        metadata={"ssh_authorized_keys": ssh_public_key},
        source_details=InstanceSourceViaImageDetails(
            image_id=image,
            boot_volume_size_in_gbs=boot_volume_gb,
        ),
    )

    print(
        f"Attempting LaunchInstance: shape=VM.Standard.A1.Flex "
        f"ocpus={ocpus} memory={memory_gb}GB region={config['region']} "
        f"ad={availability_domain} compartment={compartment[:30]}..."
    )

    try:
        response = compute.launch_instance(details)
    except ServiceError as exc:
        if _is_out_of_capacity(exc):
            print(
                "Out of host capacity for VM.Standard.A1.Flex. "
                "Workflow will retry on the next cron tick."
            )
            _set_output(success="false", reason="out_of_capacity")
            return 0
        sys.stderr.write(
            f"LaunchInstance failed (status={exc.status}, code={exc.code}): {exc.message}\n"
        )
        _set_output(success="false", reason="other")
        return 1
    except Exception as exc:  # pragma: no cover - defensive
        sys.stderr.write(f"Unexpected error: {exc}\n")
        _set_output(success="false", reason="other")
        return 1

    instance = response.data
    print(f"SUCCESS: instance launched id={instance.id} display_name={instance.display_name}")
    _set_output(
        success="true",
        instance_id=instance.id,
        display_name=instance.display_name,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
