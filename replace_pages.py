#!/usr/bin/env python3
"""
Replace pages 350-800 with blank white pages in PDF
"""
import sys
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io

def create_blank_page(width, height):
    """Create a blank white PDF page"""
    packet = io.BytesIO()
    # Use letter size as base, but we'll scale it
    can = canvas.Canvas(packet, pagesize=(width, height))
    # Draw nothing - just a blank white page
    can.save()
    packet.seek(0)
    blank_pdf = PdfReader(packet)
    if len(blank_pdf.pages) > 0:
        return blank_pdf.pages[0]
    else:
        # Fallback: create a simple blank page using PyPDF2
        from PyPDF2.generic import RectangleObject
        writer_temp = PdfWriter()
        page = writer_temp.add_blank_page(width=width, height=height)
        return page

def replace_pages(input_path, output_path, start_page, end_page):
    """Replace pages start_page to end_page (1-indexed) with blank pages"""
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        total_pages = len(reader.pages)
        print(f"Processing {input_path}...")
        print(f"Total pages: {total_pages}")
        print(f"Replacing pages {start_page} to {end_page} with blank pages")
        
        # Get page dimensions from first page
        first_page = reader.pages[0]
        page_width = float(first_page.mediabox.width)
        page_height = float(first_page.mediabox.height)
        
        for i in range(total_pages):
            page_num = i + 1  # 1-indexed
            if start_page <= page_num <= end_page:
                # Create blank page with same dimensions
                blank_page = create_blank_page(page_width, page_height)
                writer.add_page(blank_page)
                print(f"  Page {page_num}: Replaced with blank page")
            else:
                # Keep original page
                writer.add_page(reader.pages[i])
        
        # Write modified PDF
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        import os
        original_size = os.path.getsize(input_path) / (1024 * 1024)
        new_size = os.path.getsize(output_path) / (1024 * 1024)
        reduction = ((original_size - new_size) / original_size) * 100
        
        print(f"Original size: {original_size:.2f} MB")
        print(f"New size: {new_size:.2f} MB (reduced by {reduction:.1f}%)")
        return True
    except Exception as e:
        print(f"Error replacing pages: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python3 replace_pages.py <input.pdf> <output.pdf> <start_page> <end_page>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    start_page = int(sys.argv[3])
    end_page = int(sys.argv[4])
    
    if replace_pages(input_file, output_file, start_page, end_page):
        print(f"Successfully created {output_file}")
    else:
        print("Page replacement failed")
        sys.exit(1)

