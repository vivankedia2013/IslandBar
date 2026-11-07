// Reads / controls "now playing" from ANY app (browsers, Spotify, Music...) on macOS
// through the system MediaRemote framework (works on macOS 11-15.3; Apple restricts it from 15.4).
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#include <dlfcn.h>
#include <string.h>

typedef void (^IBInfoCb)(NSDictionary *info);
typedef void (*IBGetInfo)(dispatch_queue_t, IBInfoCb);
typedef Boolean (*IBSend)(int, NSDictionary *);

static void *ib_fw(void) {
    static void *h = NULL;
    if (!h) h = dlopen("/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote", RTLD_LAZY);
    return h;
}

int ib_now_playing(char *title, int tl, char *artist, int al, int *playing) {
    void *h = ib_fw();
    if (!h) return 0;
    IBGetInfo get = (IBGetInfo)dlsym(h, "MRMediaRemoteGetNowPlayingInfo");
    if (!get) return 0;
    __block NSString *t = nil;
    __block NSString *a = nil;
    __block double rate = 1.0;
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    get(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^(NSDictionary *info) {
        if (info) {
            id x = info[@"kMRMediaRemoteNowPlayingInfoTitle"];
            if ([x isKindOfClass:[NSString class]]) t = [x copy];
            x = info[@"kMRMediaRemoteNowPlayingInfoArtist"];
            if ([x isKindOfClass:[NSString class]]) a = [x copy];
            x = info[@"kMRMediaRemoteNowPlayingInfoPlaybackRate"];
            if ([x respondsToSelector:@selector(doubleValue)]) rate = [x doubleValue];
        }
        dispatch_semaphore_signal(sem);
    });
    if (dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 800 * NSEC_PER_MSEC)) != 0) return 0;
    if (!t || t.length == 0) return 0;
    strlcpy(title, [t UTF8String], (size_t)tl);
    strlcpy(artist, a ? [a UTF8String] : "", (size_t)al);
    *playing = rate > 0.0 ? 1 : 0;
    return 1;
}

// cmd: 2 = toggle play/pause, 4 = next, 5 = previous
int ib_send(int cmd) {
    void *h = ib_fw();
    if (!h) return 0;
    IBSend send = (IBSend)dlsym(h, "MRMediaRemoteSendCommand");
    if (!send) return 0;
    send(cmd, nil);
    return 1;
}

// Put the island above the menu bar, on every Space and over full-screen apps.
void ib_raise(void *w) {
    NSWindow *win = (__bridge NSWindow *)w;
    if (!win) return;
    [win setLevel:NSPopUpMenuWindowLevel];
    [win setCollectionBehavior:NSWindowCollectionBehaviorCanJoinAllSpaces |
                               NSWindowCollectionBehaviorFullScreenAuxiliary |
                               NSWindowCollectionBehaviorStationary |
                               NSWindowCollectionBehaviorIgnoresCycle];
    [win setHidesOnDeactivate:NO];
}

// Height of the camera notch (0 on Macs without one) so the island starts just below it.
// Uses a runtime selector check (no @available) so it also links on every toolchain.
double ib_notch_height(void) {
    double h = 0;
    SEL sel = NSSelectorFromString(@"safeAreaInsets");
    for (NSScreen *s in [NSScreen screens]) {
        if (![s respondsToSelector:sel]) continue;
        NSValue *v = [s valueForKey:@"safeAreaInsets"];
        if (v) {
            NSEdgeInsets in = [v edgeInsetsValue];
            if (in.top > h) h = in.top;
        }
    }
    return h;
}

// Native, GPU-driven resize: grows/shrinks the island and keeps it centred at the top.
void ib_animate(void *w, double width, double height, double top, double dur) {
    NSWindow *win = (__bridge NSWindow *)w;
    if (!win) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        NSScreen *s = win.screen ? win.screen : [NSScreen mainScreen];
        NSRect sf = s.frame;
        NSRect f = NSMakeRect(sf.origin.x + (sf.size.width - width) / 2.0,
                              sf.origin.y + sf.size.height - top - height, width, height);
        [NSAnimationContext runAnimationGroup:^(NSAnimationContext *ctx) {
            ctx.duration = dur;
            ctx.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseOut];
            ctx.allowsImplicitAnimation = YES;
            [[win animator] setFrame:f display:YES];
        } completionHandler:nil];
    });
}
