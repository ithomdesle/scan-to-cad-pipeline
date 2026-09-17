"""Execute a build123d model script and export the resulting solid to STEP.

The script source is produced upstream (deterministically or by a language model) and has already
been screened there; this runner keeps the execution namespace minimal and reports a single JSON
object on stdout so the caller never has to scrape human-readable output.
"""

import argparse
import json
import sys
import traceback

SCHEMA_BY_NAME = {
    "ap214": "AP214IS",
    "ap242": "AP242DIS",
}

RESULT_MARKER = "---SCAN2CAD-RESULT---"


def silence_kernel_logging():
    try:
        from OCP.Message import Message, Message_Gravity
    except ImportError:
        return

    messenger = Message.DefaultMessenger_s()
    for printer in messenger.Printers():
        printer.SetTraceLevel(Message_Gravity.Message_Fail)


def build_part(source):
    import build123d
    import math

    namespace = {"__builtins__": __builtins__, "math": math}
    for name in dir(build123d):
        if not name.startswith("_"):
            namespace[name] = getattr(build123d, name)

    exec(compile(source, "<model>", "exec"), namespace)

    part = namespace.get("part")
    if part is None:
        raise ValueError('The script finished without assigning a solid to "part".')

    return part


def export_part(part, output_path, schema_name):
    """Write the STEP file directly through OpenCASCADE.

    build123d's own export_step re-initialises the STEP controller on every call, which resets
    write.step.schema back to AP214, so the schema has to be applied against a writer we own.
    """
    from OCP.IFSelect import IFSelect_ReturnStatus
    from OCP.Interface import Interface_Static
    from OCP.STEPControl import (
        STEPControl_Controller,
        STEPControl_StepModelType,
        STEPControl_Writer,
    )

    STEPControl_Controller.Init_s()
    writer = STEPControl_Writer()

    occt_schema = SCHEMA_BY_NAME.get(schema_name)
    if occt_schema is None:
        raise ValueError('Unknown STEP schema "{}".'.format(schema_name))

    # The statics must be set after the writer exists: constructing it restores the defaults.
    Interface_Static.SetCVal_s("write.step.schema", occt_schema)
    Interface_Static.SetCVal_s("write.step.unit", "MM")

    writer.Transfer(part.wrapped, STEPControl_StepModelType.STEPControl_AsIs)

    if writer.Write(output_path) != IFSelect_ReturnStatus.IFSelect_RetDone:
        raise RuntimeError("OpenCASCADE refused to write the STEP file.")

    return occt_schema


def report(payload):
    sys.stdout.write("\n" + RESULT_MARKER + "\n")
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


def main():
    parser = argparse.ArgumentParser(description="Build a build123d model and export it to STEP.")
    parser.add_argument("--script", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--schema", default="ap214")
    arguments = parser.parse_args()

    try:
        silence_kernel_logging()

        with open(arguments.script, "r", encoding="utf-8") as script_file:
            source = script_file.read()

        part = build_part(source)

        volume = float(getattr(part, "volume", 0.0))
        if volume <= 0.0:
            raise ValueError(
                "The script produced a shape with no volume; it is not a solid body."
            )

        applied_schema = export_part(part, arguments.output, arguments.schema)

        report({"isSuccess": True, "volume": volume, "appliedSchema": applied_schema})
        return 0

    except Exception as error:
        report(
            {
                "isSuccess": False,
                "error": "{}: {}".format(type(error).__name__, error),
                "traceback": traceback.format_exc(limit=3),
            }
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
