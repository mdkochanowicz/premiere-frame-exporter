# Modern folder picker using COM IFileDialog (Windows Vista+ file explorer style)
$source = @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
class FileOpenDialogClass { }

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem
{
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IntPtr ppsi);
    void GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IntPtr psi, uint hint, out int piOrder);
}

[ComImport, Guid("d57c7288-d4ad-4768-be02-9d969532d960"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileDialog
{
    [PreserveSig] uint Show(IntPtr hwndOwner);
    void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
    void SetFileTypeIndex(uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise(IntPtr pfde, out uint pdwCookie);
    void Unadvise(uint dwCookie);
    void SetOptions(uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IntPtr psi);
    void SetFolder(IntPtr psi);
    void GetFolder(out IntPtr ppsi);
    void GetCurrentSelection(out IntPtr ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IntPtr ppsi);
    void AddPlace(IntPtr psi, int fdap);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(uint hr);
    void SetClientGuid(ref Guid guid);
    void ClearClientData();
    void SetFilter(IntPtr pFilter);
}

public static class FolderPicker
{
    public static string Show(string title)
    {
        var dialog = (IFileDialog)new FileOpenDialogClass();
        dialog.SetOptions(0x20); // FOS_PICKFOLDERS
        dialog.SetTitle(title);
        uint hr = dialog.Show(IntPtr.Zero);
        if (hr != 0) return string.Empty;

        IntPtr pItem;
        dialog.GetResult(out pItem);
        var item = (IShellItem)Marshal.GetObjectForIUnknown(pItem);
        IntPtr pName;
        item.GetDisplayName(0x80058000, out pName); // SIGDN_FILESYSPATH
        string path = Marshal.PtrToStringUni(pName);
        Marshal.FreeCoTaskMem(pName);
        Marshal.Release(pItem);
        return path;
    }
}
"@

Add-Type -TypeDefinition $source
[FolderPicker]::Show('Choose output folder for exported frames')
